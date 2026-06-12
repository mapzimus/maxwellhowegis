"""Reference-layer checkers (colleges / private schools / childcare centers).

These layers are upstream reference data (IPEDS / NCES PSS / EEC), not choropleths,
so the checks are coverage-only: layer-size floor, geometry, expected-field presence,
and — only where the key is a TRUE unique id — key uniqueness.

Verified data realities (which differ from naive assumptions):
  - colleges:  keyed on NAME (no UNITID); coordinates live in geometry, not lon/lat props
  - childcare: keyed on NAME (non-unique) (no TOWN_ID); coordinates in geometry
  - private:   PPIN is a real unique id; has lon/lat
"""

from .base import LayerChecker, RawFinding, register


class CoverageOnlyChecker(LayerChecker):
    layer_name = None
    key_field = None
    key_is_unique = False        # only True for a genuine unique id (e.g. PPIN)
    require_geometry = True
    expected_fields = ()
    min_features = 0

    def applicable(self, tables):
        try:
            return tables.reference(self.layer_name) is not None
        except Exception:
            return False

    def check(self, tables):
        df = tables.reference(self.layer_name)
        n = len(df)

        if self.min_features and n < self.min_features:
            yield RawFinding(self.level, "_layer", "LAYER_SHRUNK", "*", "high",
                             f"{n} features (< expected floor {self.min_features}) "
                             f"— layer may have dropped data", {"count": n})

        if self.key_field and self.key_field not in df.columns:
            yield RawFinding(self.level, self.key_field, "FIELD_ABSENT", "*", "high",
                             f"key field '{self.key_field}' absent from {df.attrs.get('file')}", None)
        elif self.key_is_unique and self.key_field:
            kv = df[self.key_field].astype(str)
            dups = sorted(set(kv[kv.duplicated() & (kv.str.strip() != "")]))
            if dups:
                yield RawFinding(self.level, self.key_field, "KEY_DUP", "*", "high",
                                 f"{len(dups)} duplicate {self.key_field} value(s) "
                                 f"(e.g. {dups[0]})", {"count": len(dups)})

        if self.require_geometry:
            nogeo = int((df["_lon"].isna() | df["_lat"].isna()).sum())
            if nogeo:
                yield RawFinding(self.level, "geometry", "NULL_GEOMETRY", "*", "high",
                                 f"{nogeo} features missing coordinates", {"count": nogeo})

        for f in self.expected_fields:
            if f not in df.columns:
                yield RawFinding(self.level, f, "FIELD_ABSENT", "*", "med",
                                 f"expected field '{f}' absent from {self.layer_name}", None)
            elif int(df[f].notna().sum()) == 0:
                yield RawFinding(self.level, f, "FIELD_EMPTY", "*", "med",
                                 f"field '{f}' present but entirely empty", None)


@register
class CollegesChecker(CoverageOnlyChecker):
    level = "colleges"
    layer_name = "colleges"
    key_field = "NAME"
    key_is_unique = False        # NAME is not a stable id; satellites repeat
    require_geometry = True
    expected_fields = ("NAME", "CITY", "sector", "enrollment", "grad_rate", "net_price")
    min_features = 100


@register
class PrivateSchoolsChecker(CoverageOnlyChecker):
    level = "private"
    layer_name = "private"
    key_field = "PPIN"
    key_is_unique = True         # NCES PPIN is a true unique id
    require_geometry = True
    expected_fields = ("PPIN", "NAME", "TOWN", "GRADES", "ENROLLMENT")
    min_features = 450


@register
class ChildcareChecker(CoverageOnlyChecker):
    level = "childcare"
    layer_name = "childcare"
    key_field = "NAME"
    key_is_unique = False        # NAME repeats across chains — dup is not a bug
    require_geometry = True
    expected_fields = ("NAME", "CITY", "capacity")
    min_features = 2500
