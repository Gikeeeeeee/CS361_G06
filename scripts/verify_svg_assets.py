"""Offline SVG syntax, floor-plan references and built public-asset checks."""
import argparse
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]


def verify(root, build_dir=None):
    errors = []
    data = root / "building-data"
    public = root / "frontend/public"
    plans = {p.relative_to(data).as_posix(): p for p in (data / "floor-plan").rglob("*.svg")}
    public_svgs = {p.relative_to(public).as_posix(): p for p in public.rglob("*.svg")}
    for path in [*plans.values(), *public_svgs.values()]:
        try:
            if ET.parse(path).getroot().tag != "{http://www.w3.org/2000/svg}svg":
                errors.append(f"Non-SVG root: {path.relative_to(root)}")
        except ET.ParseError:
            errors.append(f"Malformed SVG XML: {path.relative_to(root)}")
    if not plans or not public_svgs:
        errors.append("Expected floor-plan and public SVG assets")

    references = set()
    buildings = sorted((data / "building").glob("*.json"))
    if not buildings:
        errors.append("No building JSON files found")
    for path in buildings:
        for floor in json.loads(path.read_text(encoding="utf-8"))["floors"]:
            key = floor.get("floor_plan_key")
            if not isinstance(key, str) or not key:
                errors.append(f"Missing floor_plan_key: {path.name}, floor {floor.get('floor_number')}")
            else:
                references.add(key)
    errors.extend(f"Missing floor-plan asset (case-sensitive): {key}" for key in sorted(references - plans.keys()))
    errors.extend(f"Unreferenced floor-plan asset: {key}" for key in sorted(plans.keys() - references))

    # Check literal local SVG URLs in HTML/CSS/TS/TSX. Runtime API URLs and
    # imported assets remain covered by the loader regressions and Vite build.
    sources = [root / "frontend/index.html", *(root / "frontend/src").rglob("*")]
    for source in sources:
        if source.suffix not in {".html", ".css", ".ts", ".tsx"}:
            continue
        for key in re.findall(r'''["'](/[^"'?#\s]+\.svg)(?:[?#][^"']*)?["']''', source.read_text(encoding="utf-8")):
            if key[1:] not in public_svgs:
                errors.append(f"Missing public SVG: {key} in {source.relative_to(root)}")

    if build_dir is not None:
        if not (build_dir / "index.html").is_file():
            errors.append("Production build index.html is missing")
        for key, path in public_svgs.items():
            built = build_dir / key
            if not built.is_file() or built.read_bytes() != path.read_bytes():
                errors.append(f"Missing or stale built public SVG: {key}")
        built_svgs = {p.relative_to(build_dir).as_posix() for p in build_dir.rglob("*.svg")}
        errors.extend(f"Unexpected built SVG: {key}" for key in sorted(built_svgs - public_svgs.keys()))
    return errors, len(plans) + len(public_svgs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build-dir", type=Path, help="Also verify a fresh production build")
    args = parser.parse_args()
    try:
        errors, count = verify(ROOT, args.build_dir)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"SVG verification failed: {exc}")
        return 1
    if errors:
        print("\n".join(errors))
        return 1
    print(f"PASS {count} SVG assets: XML, floor-plan references, local public URLs"
          + (" and fresh build copies" if args.build_dir else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
