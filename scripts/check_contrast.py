#!/usr/bin/env python3
# check_contrast.py — simple WCAG contrast checks for brand palette
import math

def hex_to_rgb(hexstr):
    h = hexstr.lstrip('#')
    return tuple(int(h[i:i+2],16)/255.0 for i in (0,2,4))

def luminance(rgb):
    def chan(c):
        return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    r,g,b = rgb
    return 0.2126*chan(r)+0.7152*chan(g)+0.0722*chan(b)

def contrast(hex1, hex2):
    def resolve(c):
        if not c: return c
        if c.startswith('#'): return c
        if c in brand: return brand[c]
        raise ValueError('Unknown color: ' + str(c))
    h1 = resolve(hex1)
    h2 = resolve(hex2)
    l1 = luminance(hex_to_rgb(h1))
    l2 = luminance(hex_to_rgb(h2))
    Lbright = max(l1,l2)
    Ldark = min(l1,l2)
    return (Lbright+0.05)/(Ldark+0.05)

import re

def read_css_vars(path):
    vars = {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            css = f.read()
    except Exception:
        return vars
    for m in re.finditer(r"--([a-zA-Z0-9\-]+)\s*:\s*(#[0-9A-Fa-f]{6})", css):
        vars[m.group(1)] = m.group(2)
    return vars

css_vars = read_css_vars('css/app.css')
brand = {
    'forest': css_vars.get('brand-forest', '#2E4A3D'),
    'cream':  css_vars.get('brand-cream', '#F4EBDD'),
    'sage':   css_vars.get('brand-sage', '#A9B8A5'),
    'clay':   css_vars.get('brand-clay', '#C97B63'),
    'dark':   css_vars.get('brand-dark', '#1F2A24')
}

pairs = [
    ('forest','cream'),
    ('forest','1FFFFFF'),
    ('clay','cream'),
    ('dark','cream'),
    ('sage','cream')
]

print('Brand contrast report:')
for a,b in [('forest','cream'),('forest','#ffffff'),('clay','cream'),('clay','#ffffff'),('dark','cream'),('sage','cream')]:
    ratio = contrast(brand[a], b if b.startswith('#') else b)
    print(f"{a} ({brand[a]}) on {b}: {ratio:.2f}:1")

# Evaluate against AA thresholds: 4.5 for normal text, 3.0 for large text
checks = [
    ('forest', 'cream', 4.5),
    ('forest', '#ffffff', 4.5),
    ('clay', 'cream', 4.5),
    ('dark', 'cream', 4.5),
    ('sage', 'cream', 3.0)
]

print('\nRecommendations:')
for fg,bg,threshold in checks:
    r = contrast(brand[fg], bg if bg.startswith('#') else bg)
    ok = r >= threshold
    status = 'PASS' if ok else 'FAIL'
    print(f"{fg} on {bg}: {r:.2f}:1 ({status}, threshold {threshold})")

# Simple suggestion: if forest on cream fails, suggest darken forest by 10%
print('\nIf any FAIL, consider increasing contrast by darkening the foreground or lightening the background.')
