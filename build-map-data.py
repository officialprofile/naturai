from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "map.json"
TARGET = ROOT / "map-data.js"


def main():
    data = SOURCE.read_text(encoding="utf-8").strip()
    TARGET.write_text("window.NATURAI_MAP_JSON = " + data + ";\n", encoding="utf-8")
    print(f"Wrote {TARGET.name} from {SOURCE.name}")


if __name__ == "__main__":
    main()
