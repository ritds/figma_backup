#!/usr/bin/python3 -u

import sys
import os
from pathlib import Path
from hashlib import md5


def main():
    if len(sys.argv) >= 3:
        source_dir_path = Path(sys.argv[1])
        target_dir_path = Path(sys.argv[2])

    else:
        print('2 parameters must be specified: source directory, target directory')
        sys.exit(1)

    print('Scanning files')

    for source_file_path in source_dir_path.rglob('*.fig'):
        with open(source_file_path, 'rb') as source_file:
            hash = md5(source_file.read()).hexdigest()

        target_file_path = target_dir_path / f'{hash}.fig'

        print(f'\nSource file: {source_file_path}')
        print(f'Target file: {target_file_path}')

        if target_file_path.exists():
            os.unlink(source_file_path)
            print('Target already exists, source deleted')

        else:
            target_dir_path.mkdir(parents=True, exist_ok=True)
            os.rename(source_file_path, target_file_path)
            print('Source moved')

        os.symlink(target_file_path, source_file_path)
        print('Symlink created')

    print('done')


if __name__ == "__main__":
    main()
