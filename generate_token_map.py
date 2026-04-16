import csv

with open("coingecko-active-coins-list.csv", "r") as f:
    reader = csv.reader(f)
    next(reader)  # Skip header
    mapping = {rows[1].upper(): rows[0] for rows in reader if rows}

with open("token_map.ts", "w") as f:
    f.write("export const TOKEN_TO_CG_ID: Record<string, string> = {\n")
    for symbol, cg_id in mapping.items():
        f.write(f"  \"{symbol}\": \"{cg_id}\",\n")
    f.write("};\n")
