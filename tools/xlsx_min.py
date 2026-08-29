#!/usr/bin/env python3
"""A read-only .xlsx reader in ~70 lines of stdlib.

WHY THIS EXISTS. Every other HEAPweb builder reads a HEAP output TSV, and that
is the rule. One flag cannot be built that way: the intervention concordance
needs to know which proteins each trial ASSAYED, not only which ones it
reported as significant, and that fact lives only in the trials' own
supplementary workbooks (`GLP1_proteomics.xlsx`, `jciinsight_prot.xlsx`). The
deposit is downstream of a q<0.05 filter and has already thrown it away.

O2's system python3 has neither openpyxl nor pandas, and this repo has no
requirements file, so the choice was a dependency or 70 lines. An .xlsx is a
zip of XML; this reads the parts it needs and nothing else.

Deliberately NOT supported: dates (returned as the raw Excel serial), number
formats, formulas (the cached <v> is returned), merged cells. The two trial
workbooks are flat statistics tables, so none of that applies -- do not reach
for this reader on a spreadsheet that uses those features.
"""
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def _col_index(ref):
    """'BC12' -> 54. Cells are addressed, not ordered: a row that skips a
    column emits no <c> for it, so positional reading silently shifts every
    later value left. Always place by address."""
    n = 0
    for ch in ref:
        if ch.isalpha():
            n = n * 26 + (ord(ch.upper()) - 64)
        else:
            break
    return n - 1


def sheet_names(path):
    with zipfile.ZipFile(path) as z:
        return [s.get("name")
                for s in ET.fromstring(z.read("xl/workbook.xml")).iter(NS + "sheet")]


def sheet_rows(path, sheet_name=None, sheet_index=0, skip=0):
    """Rows of one sheet as dicts keyed by the header row.

    `skip` is the number of leading rows to drop BEFORE the header, for sheets
    that open with a title line (HERITAGE's does). Note this is not readxl's
    `skip`, which counts differently -- state the header row explicitly.
    """
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")):
                shared.append("".join(t.text or "" for t in si.iter(NS + "t")))
        rels = {r.get("Id"): r.get("Target")
                for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
        sheets = [(s.get("name"), rels[s.get(RNS + "id")])
                  for s in ET.fromstring(z.read("xl/workbook.xml")).iter(NS + "sheet")]
        target = dict(sheets)[sheet_name] if sheet_name is not None else sheets[sheet_index][1]
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")
        root = ET.fromstring(z.read(target))

    grid = []
    for row in root.iter(NS + "row"):
        cells = {}
        for c in row:
            v, t = c.find(NS + "v"), c.get("t")
            if t == "inlineStr":
                node = c.find(NS + "is")
                val = "".join(x.text or "" for x in node.iter(NS + "t")) if node is not None else ""
            elif v is None:
                val = ""
            elif t == "s":
                val = shared[int(v.text)]
            else:
                val = v.text or ""
            cells[_col_index(c.get("r") or "")] = val
        if cells:
            grid.append([cells.get(i, "") for i in range(max(cells) + 1)])

    grid = grid[skip:]
    if not grid:
        return []
    header = grid[0]
    return [dict(zip(header, r + [""] * (len(header) - len(r)))) for r in grid[1:]]
