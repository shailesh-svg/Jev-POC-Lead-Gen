from io import BytesIO
from pathlib import Path
from docx import Document
from openpyxl import load_workbook
from pypdf import PdfReader
from fastapi import HTTPException

MAX_BYTES = 10 * 1024 * 1024
MAX_TEXT = 60000
# A queue of leads is longer than one document, and rows are cheap.
MAX_DOCUMENT_TEXT = 200000
MAX_SHEET_ROWS = 2000

DOCUMENT_KINDS = ('pdf', 'docx', 'xlsx', 'csv', 'tsv', 'txt', 'md')
# Word 97-2003 and Excel 97-2003 are different formats, not older versions of
# the ones above, and neither reader opens them.
LEGACY = {'doc': 'Word 97-2003 (.doc)', 'xls': 'Excel 97-2003 (.xls)'}

def _pdf(data: bytes):
    reader = PdfReader(BytesIO(data))
    if reader.is_encrypted:
        raise ValueError('Remove the PDF password before upload.')
    if len(reader.pages) > 50:
        raise ValueError('Use a PDF with 50 pages or fewer.')
    return '\n\n'.join(p.extract_text() or '' for p in reader.pages).strip()

def _docx(data: bytes):
    document = Document(BytesIO(data))
    parts = [p.text.strip() for p in document.paragraphs if p.text.strip()]
    # Tables carry the rows in a lead list, so keep them as tab-separated rows.
    for table in document.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            if any(cells):
                parts.append('\t'.join(cells))
    return '\n'.join(parts).strip()

def _xlsx(data: bytes):
    workbook = load_workbook(BytesIO(data), read_only=True, data_only=True)
    lines = []
    for sheet in workbook.worksheets:
        for row in sheet.iter_rows(values_only=True):
            cells = ['' if v is None else str(v).strip() for v in row]
            if any(cells):
                lines.append('\t'.join(cells))
            if len(lines) >= MAX_SHEET_ROWS:
                break
    workbook.close()
    # Tab-separated rows, so one row reads as one lead downstream.
    return '\n'.join(lines).strip()

def _plain(data: bytes):
    return data.decode('utf-8', errors='replace').strip()

READERS = {'pdf': _pdf, 'docx': _docx, 'xlsx': _xlsx, 'csv': _plain, 'tsv': _plain, 'txt': _plain, 'md': _plain}

def extract_document(data: bytes, filename: str, kinds=DOCUMENT_KINDS, limit=MAX_DOCUMENT_TEXT):
    """Text out of one uploaded file. Raises HTTPException with a usable message."""
    kind = Path(filename).suffix.lower().lstrip('.')
    if kind in LEGACY and kind not in kinds:
        raise HTTPException(415, f'{LEGACY[kind]} is not supported. Save it as {kind}x and try again.')
    if kind not in kinds:
        raise HTTPException(415, 'Supported files: ' + ', '.join('.' + k for k in kinds) + '.')
    try:
        text = READERS[kind](data)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception:
        raise HTTPException(422, f'Could not read this {kind.upper()} file. Check that it is valid.')
    if len(text) < 20:
        raise HTTPException(422, 'Not enough text was found. Scanned files and images are not supported yet.')
    if len(text) > limit:
        raise HTTPException(422, f'This file holds too much text. Use one with fewer than {limit:,} characters.')
    return text, kind

def extract(data: bytes, filename: str):
    """PDF only: the review and classification tools accept nothing else."""
    return extract_document(data, filename, kinds=('pdf',), limit=MAX_TEXT)
