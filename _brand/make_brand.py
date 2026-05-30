# -*- coding: utf-8 -*-
"""Generate Pixton brand assets: X avatar (400x400) and header banner (1500x500)."""
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(HERE, "fonts")

# palette
INK="#14141c"; INK2="#1d1d27"; INK3="#262631"; RULE="#3a3a45"; RULE2="#4d4d58"
PAPER="#f3ecd8"; PAPER2="#d8d2bf"; MIST="#8a8c8a"
EMBER="#d96638"; EMBER_DEEP="#a04420"; MOSS="#6f8a4f"; AMBER="#e6b94a"
WATER="#256e7a"; WATER_HI="#5fa898"; WATER_RIM="#1d4f57"; SKIN="#e8c39a"
SHADOW="#100f17"; LEG="#2a2a30"

def hx(h):
    h=h.lstrip("#"); return (int(h[0:2],16),int(h[2:4],16),int(h[4:6],16))

def font(name,size): return ImageFont.truetype(os.path.join(F,name),size)

SIL  = lambda s: font("Silkscreen-Regular.ttf", s)
MONO = lambda s: font("IBMPlexMono-Regular.ttf", s)
MONOM= lambda s: font("IBMPlexMono-Medium.ttf", s)
INTER= lambda s: font("Inter.ttf", s)

def glow(base, cx, cy, radius, color, max_a):
    W,H=base.size; s=6
    lw,lh=max(1,W//s),max(1,H//s)
    m=Image.new("L",(lw,lh),0); px=m.load()
    for y in range(lh):
        for x in range(lw):
            dx=(x*s-cx)/radius; dy=(y*s-cy)/radius
            d=(dx*dx+dy*dy)**0.5
            a=max(0.0,1.0-d)
            px[x,y]=int(max_a*a*a)
    m=m.resize((W,H),Image.BILINEAR)
    col=Image.new("RGBA",(W,H),hx(color)+(0,)); col.putalpha(m)
    base.alpha_composite(col)

def dots(d, x0,y0,x1,y1, step, color, r=1):
    c=hx(color)
    y=y0
    while y<y1:
        x=x0
        while x<x1:
            d.rectangle([x,y,x+r,y+r], fill=c)
            x+=step
        y+=step

def resident(d, ox, oy, u, hair, cloth, skin=SKIN):
    def R(x,y,w,h,c): d.rectangle([ox+x*u, oy+y*u, ox+(x+w)*u-1, oy+(y+h)*u-1], fill=hx(c) if isinstance(c,str) else c)
    R(0,12,8,2,SHADOW)
    R(1,9,2,3,LEG); R(5,9,2,3,LEG)
    R(0,4,8,6,cloth)
    R(-1,5,1,3,cloth); R(8,5,1,3,cloth)
    R(1,0,6,5,skin)
    R(1,-1,6,2,hair); R(0,0,1,3,hair); R(7,0,1,3,hair)
    R(4,2,1,1,INK)

def corners(d, x,y,w,h, ln, th, color=EMBER):
    c=hx(color)
    d.rectangle([x,y,x+ln,y+th-1],fill=c);       d.rectangle([x,y,x+th-1,y+ln],fill=c)
    d.rectangle([x+w-ln,y,x+w,y+th-1],fill=c);    d.rectangle([x+w-th,y,x+w,y+ln],fill=c)
    d.rectangle([x,y+h-th,x+ln,y+h],fill=c);      d.rectangle([x,y+h-ln,x+th-1,y+h],fill=c)
    d.rectangle([x+w-ln,y+h-th,x+w,y+h],fill=c);  d.rectangle([x+w-th,y+h-ln,x+w,y+h],fill=c)

def text_ls(d, pos, s, fnt, fill, ls=0):
    x,y=pos; c=hx(fill)
    for ch in s:
        d.text((x,y),ch,font=fnt,fill=c)
        x+=d.textlength(ch,font=fnt)+ls
    return x

# mini palettes (hair, cloth)
PALS=[("#4a4a8c","#d6d6f0"),("#c1432f","#f2c98a"),("#256e7a","#5fa898"),
      ("#2b1117","#9b1d3a"),("#6f4f1f","#b87333"),("#d34a8f","#4a4a4a")]

def mini_town(d, bx,by,bw,bh):
    t=16; cols=bw//t; rows=bh//t
    midc=cols//2; midr=rows//2
    for ry in range(rows):
        for rx in range(cols):
            cobble = (midr-1<=ry<=midr+1) or (midc-1<=rx<=midc+1)
            if cobble: col = RULE if (rx+ry)%2 else INK3
            else:      col = "#1f2a1c" if (rx+ry)%2 else "#243018"
            d.rectangle([bx+rx*t,by+ry*t,bx+(rx+1)*t-1,by+(ry+1)*t-1], fill=hx(col))
    # fountain
    fx=bx+(midc-1)*t; fy=by+(midr-1)*t
    d.rectangle([fx-3,fy-3,fx+2*t+2,fy+2*t+2],fill=hx(WATER_RIM))
    d.rectangle([fx,fy,fx+2*t-1,fy+2*t-1],fill=hx(WATER))
    d.rectangle([fx+5,fy+6,fx+11,fy+8],fill=hx(WATER_HI))
    d.rectangle([fx+t+2,fy+t+5,fx+t+9,fy+t+7],fill=hx(WATER_HI))
    d.rectangle([fx+t-3,fy+5,fx+t+1,fy+2*t-6],fill=hx(PAPER2))
    # residents around
    u=4
    spots=[(3,3,0),(cols-6,4,1),(4,rows-6,2),(cols-7,rows-5,3),(midc+3,2,4),(2,midr+3,5)]
    for sx,sy,pi in spots:
        h,c=PALS[pi]
        resident(d, bx+sx*t, by+sy*t, u, h, c)

# ---------------------------------------------------------------- AVATAR
def make_avatar(path):
    # ember mascot centered on a pure-black background — no corners, glow or dots
    W=H=400
    img=Image.new("RGBA",(W,H),(0,0,0,255))
    d=ImageDraw.Draw(img)
    u=22; ox=(W-8*u)//2; oy=66
    resident(d, ox, oy, u, EMBER_DEEP, EMBER)
    # antenna ember dot above the head
    dx=ox+int(3.3*u); dy=oy-int(2.3*u)
    d.rectangle([dx,dy,dx+15,dy+15], fill=hx(EMBER))
    img.convert("RGB").save(path)
    print("avatar ->", path)

# ---------------------------------------------------------------- BANNER
def make_banner(path):
    W,H=1500,500
    img=Image.new("RGBA",(W,H),hx(INK)+(255,))
    glow(img, 1240, -40, 760, EMBER, 70)
    glow(img, -60, 560, 680, MOSS, 48)
    d=ImageDraw.Draw(img)
    dots(d, 40,40, 1460,460, 26, "#20202b", 1)

    # right viewfinder scene
    bx,by,bw,bh=980,86,432,328
    d.rectangle([bx,by,bx+bw,by+bh], fill=hx("#11111a"))
    mini_town(d, bx,by,bw,bh)
    corners(d, bx-8,by-8, bw+16,bh+16, 44, 7, EMBER)
    # LIVE label
    d.rectangle([bx+14,by+15,bx+25,by+26], fill=hx(EMBER))
    text_ls(d,(bx+34,by+13),"LIVE",MONOM(18),EMBER,2)

    # divider
    d.rectangle([946,80,947,420], fill=hx(RULE))
    d.rectangle([946,80,947,92], fill=hx(EMBER))

    # left text block
    x0=96
    text_ls(d,(x0,128),"FIELD STATION 01",MONOM(22),EMBER,6)
    # logo PIX (ember) + TON (paper)
    lf=SIL(116); ly=168
    d.text((x0-2,ly),"PIX",font=lf,fill=hx(EMBER))
    w1=d.textlength("PIX",font=lf)
    d.text((x0-2+w1+6,ly),"TON",font=lf,fill=hx(PAPER))
    # tagline
    d.text((x0,316),"A small town that runs whether or not you watch.",font=INTER(30),fill=hx(PAPER2))
    # mono spec line
    text_ls(d,(x0,360),"25×18 GRID  ·  2.0s TICK  ·  OPEN SOURCE",MONO(20),MIST,1)
    # handle
    text_ls(d,(x0,398),"@PixeTown",MONOM(20),EMBER,2)

    img.convert("RGB").save(path)
    print("banner ->", path)

# ---------------------------------------------------------------- SOCIAL CARD
def make_social(path):
    # GitHub social preview / OG image — 1280x640
    W,H=1280,640
    img=Image.new("RGBA",(W,H),hx(INK)+(255,))
    glow(img, 1050, -40, 700, EMBER, 72)
    glow(img, -60, 720, 660, MOSS, 48)
    d=ImageDraw.Draw(img)
    dots(d, 40,40, 1240,600, 26, "#20202b", 1)

    # right viewfinder scene
    bx,by,bw,bh=773,150,420,340
    d.rectangle([bx,by,bx+bw,by+bh], fill=hx("#11111a"))
    mini_town(d, bx,by,bw,bh)
    corners(d, bx-8,by-8, bw+16,bh+16, 44, 7, EMBER)
    d.rectangle([bx+14,by+15,bx+25,by+26], fill=hx(EMBER))
    text_ls(d,(bx+34,by+13),"LIVE",MONOM(18),EMBER,2)

    # divider
    d.rectangle([722,152,723,488], fill=hx(RULE))
    d.rectangle([722,152,723,164], fill=hx(EMBER))

    # left text block
    x0=80
    text_ls(d,(x0,206),"FIELD STATION 01",MONOM(22),EMBER,6)
    lf=SIL(112); ly=248
    d.text((x0-2,ly),"PIX",font=lf,fill=hx(EMBER))
    w1=d.textlength("PIX",font=lf)
    d.text((x0-2+w1+6,ly),"TON",font=lf,fill=hx(PAPER))
    d.text((x0,392),"A small town that runs whether",font=INTER(29),fill=hx(PAPER2))
    d.text((x0,430),"or not you watch.",font=INTER(29),fill=hx(PAPER2))
    text_ls(d,(x0,482),"25×18 GRID  ·  2.0s TICK  ·  OPEN SOURCE",MONO(19),MIST,1)
    text_ls(d,(x0,518),"@PixeTown",MONOM(20),EMBER,2)

    img.convert("RGB").save(path)
    print("social ->", path)

if __name__=="__main__":
    make_avatar(os.path.join(HERE,"pixton-avatar.png"))
    make_banner(os.path.join(HERE,"pixton-banner.png"))
    make_social(os.path.join(HERE,"pixton-social.png"))
