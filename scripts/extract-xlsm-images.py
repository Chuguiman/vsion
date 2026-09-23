# -*- coding: utf-8 -*-
"""
Extrae las imagenes embebidas en los .xlsm de cartera y las asocia a su marca por
el ANCLAJE real: cada imagen esta anclada a una fila (columna C "Imagen"); el
codigo de esa marca esta en la columna A ("Numero de caso"). Renombra cada imagen
por su codigo (sanitizado) y escribe un manifiesto codigo<->archivo.

Uso:
  python scripts/extract-xlsm-images.py --dir "<carpeta>" --out "<salida>" [--dry-run]
  python scripts/extract-xlsm-images.py --xlsm "<archivo.xlsm>" --out "<salida>" [--dry-run]
"""
import zipfile, xml.etree.ElementTree as ET, re, os, sys, glob, csv, argparse

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
XDR = "{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PR = "{http://schemas.openxmlformats.org/package/2006/relationships}"

def shared_strings(z):
    out = []
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return out
    for si in root.findall(f"{M}si"):
        out.append("".join(t.text or "" for t in si.iter(f"{M}t")))
    return out

def cellval(c, ss):
    t = c.get("t"); v = c.find(f"{M}v")
    if t == "s" and v is not None and v.text is not None:
        return ss[int(v.text)]
    if v is not None and v.text is not None:
        return v.text
    isv = c.find(f"{M}is")
    return "".join(x.text or "" for x in isv.iter(f"{M}t")) if isv is not None else ""

def sanitize(code):
    return re.sub(r"[^A-Za-z0-9._-]", "_", code)

def process(xlsm, outdir, manifest_rows, dry):
    z = zipfile.ZipFile(xlsm)
    ss = shared_strings(z)
    # hoja: fila(1-based) -> A, B
    rowA, rowB = {}, {}
    sh = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    for r in sh.find(f"{M}sheetData").findall(f"{M}row"):
        rn = int(r.get("r"))
        for c in r.findall(f"{M}c"):
            col = re.match(r"[A-Z]+", c.get("r")).group()
            if col == "A": rowA[rn] = cellval(c, ss).strip()
            elif col == "B": rowB[rn] = cellval(c, ss).strip()
    # rels: rId -> media path
    rels = {}
    rroot = ET.fromstring(z.read("xl/drawings/_rels/drawing1.xml.rels"))
    for rel in rroot.findall(f"{PR}Relationship"):
        rels[rel.get("Id")] = rel.get("Target").split("/")[-1]
    # anchors
    dr = ET.fromstring(z.read("xl/drawings/drawing1.xml"))
    n_ok = n_nocode = n_nomedia = 0
    src = os.path.basename(xlsm)
    for anc in dr.iter(f"{XDR}oneCellAnchor"):
        frm = anc.find(f"{XDR}from")
        row0 = int(frm.find(f"{XDR}row").text)
        blip = anc.find(f".//{A}blip")
        rid = blip.get(f"{R}embed") if blip is not None else None
        media = rels.get(rid)
        code = rowA.get(row0 + 1, "").strip()
        denom = rowB.get(row0 + 1, "").strip()
        if not media: n_nomedia += 1; continue
        if not code:  n_nocode += 1; continue
        ext = os.path.splitext(media)[1].lower() or ".jpg"
        fname = sanitize(code) + ext
        if not dry:
            with open(os.path.join(outdir, fname), "wb") as fh:
                fh.write(z.read("xl/media/" + media))
        manifest_rows.append({"filename": fname, "code": code, "denom": denom, "ext": ext.lstrip("."), "source": src})
        n_ok += 1
    print(f"  {src}: imagenes={n_ok}  sin_codigo={n_nocode}  sin_media={n_nomedia}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir"); ap.add_argument("--xlsm"); ap.add_argument("--out", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    files = []
    if a.xlsm: files = [a.xlsm]
    elif a.dir: files = sorted(glob.glob(os.path.join(a.dir, "*.xlsm")))
    else: sys.exit("Falta --dir o --xlsm")
    if not files: sys.exit("No se encontraron .xlsm")
    os.makedirs(a.out, exist_ok=True)
    rows = []
    print(f"{'DRY-RUN: ' if a.dry_run else ''}Procesando {len(files)} archivo(s) -> {a.out}")
    for f in files:
        process(f, a.out, rows, a.dry_run)
    # manifiesto (siempre)
    manifest = os.path.join(a.out, "manifest.csv")
    with open(manifest, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["filename", "code", "denom", "ext", "source"])
        w.writeheader(); w.writerows(rows)
    codes = {r["code"] for r in rows}
    dups = len(rows) - len(codes)
    print(f"TOTAL imagenes={len(rows)}  codigos_distintos={len(codes)}  codigos_repetidos={dups}")
    print(f"Manifiesto: {manifest}")

if __name__ == "__main__":
    main()
