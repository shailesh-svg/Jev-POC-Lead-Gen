from io import BytesIO
from pathlib import Path
from pypdf import PdfReader
from fastapi import HTTPException

MAX_BYTES = 10 * 1024 * 1024
MAX_TEXT = 60000

def extract(data: bytes, filename: str):
    kind = Path(filename).suffix.lower().lstrip('.')
    if kind != 'pdf':
        raise HTTPException(415, 'Only PDF files are supported in this version.')
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise ValueError('Remove the PDF password before upload.')
        if len(reader.pages) > 50:
            raise ValueError('Use a PDF with 50 pages or fewer.')
        text = '\n\n'.join(p.extract_text() or '' for p in reader.pages).strip()
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception:
        raise HTTPException(422, 'Could not read this PDF. Check that the file is valid.')
    if len(text) < 20:
        raise HTTPException(422, 'Not enough text was found. Use a PDF with selectable text. Scanned PDFs are not supported yet.')
    if len(text) > MAX_TEXT:
        raise HTTPException(422, 'The PDF contains too much text. Use a file with fewer than 60,000 characters.')
    return text, kind
