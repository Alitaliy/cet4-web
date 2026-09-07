"""Build the downloadable, self-contained Skill. No personal data is included."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
skill = root / 'skills/cet4-vocab-coach'
output = root / 'public/cet4-vocab-coach.zip'
output.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for file in sorted(skill.rglob('*')):
        if file.is_file() and '__pycache__' not in file.parts and file.suffix != '.pyc':
            archive.write(file, 'cet4-vocab-coach/' + file.relative_to(skill).as_posix())
print(f'Packaged {output.name} ({output.stat().st_size:,} bytes)')
