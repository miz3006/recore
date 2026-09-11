#!/usr/bin/env python3
"""S8 — do the alias_overrides insert AND update policies constrain exercise_id?

Split out of security-verify.sh because the match spans lines and `grep -z`
means different things in GNU grep and ugrep (null-data vs decompress). Exits 0
when both policies name public.exercises inside their own with-check.
"""
import glob
import re
import sys

PATTERN = re.compile(
    r"create\s+policy\s+alias_overrides_(insert|update)\b[^;]*public\.exercises",
    re.S,
)

found = {
    m.group(1)
    for path in glob.glob("supabase/migrations/*.sql")
    for m in PATTERN.finditer(open(path, encoding="utf-8").read())
}

sys.exit(0 if {"insert", "update"} <= found else 1)
