"""Create a small source ZIP. Run: python3 scripts/package_source.py"""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "release" / "typesafeAI-source.zip"


def main():
    # Include source files explicitly so local credentials and data stay private.
    files = [ROOT / name for name in (
        "Readme.MD", ".gitignore", "requirements.txt", "requirements-dev.txt",
        "frontend/package.json", "frontend/package-lock.json",
        "frontend/index.html", "frontend/tsconfig.json", "frontend/vite.config.ts",
        "backend/profile_templates.json", "scripts/package_source.py",
    )]
    files.extend((ROOT / "backend").glob("*.py"))
    files.extend((ROOT / "backend/tests").glob("test_*.py"))
    files.extend(path for path in (ROOT / "frontend/src").rglob("*")
                 if path.is_file() and path.suffix in {".ts", ".tsx", ".css", ".svg"})
    OUTPUT.parent.mkdir(exist_ok=True)
    with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(set(files)):
            archive.write(path, Path("typesafeAI") / path.relative_to(ROOT))
    print(f"Created {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
