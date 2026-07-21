from __future__ import annotations
import struct, zlib

class Resampling:
    NEAREST = 0

class Image:
    def __init__(self, mode, size, data=None):
        self.mode=mode; self.width,self.height=size; self.size=size
        self.data=bytearray(data if data is not None else b'\x00'*(self.width*self.height*4))
    def convert(self, mode):
        if mode!='RGBA': raise NotImplementedError(mode)
        return self
    def crop(self, box):
        l,t,r,b=map(int,box); w=r-l; h=b-t; out=Image('RGBA',(w,h))
        for y in range(h):
            sy=t+y
            if 0 <= sy < self.height:
                for x in range(w):
                    sx=l+x
                    if 0 <= sx < self.width:
                        out.data[(y*w+x)*4:(y*w+x+1)*4]=self.data[(sy*self.width+sx)*4:(sy*self.width+sx+1)*4]
        return out
    def alpha_composite(self, src, dest=(0,0)):
        dx,dy=map(int,dest)
        for y in range(src.height):
            ty=dy+y
            if not (0 <= ty < self.height): continue
            for x in range(src.width):
                tx=dx+x
                if not (0 <= tx < self.width): continue
                si=(y*src.width+x)*4; di=(ty*self.width+tx)*4
                sr,sg,sb,sa=src.data[si:si+4]
                if sa==255:
                    self.data[di:di+4]=src.data[si:si+4]
                elif sa:
                    dr,dg,db,da=self.data[di:di+4]
                    a=sa/255; ia=1-a
                    self.data[di:di+4]=bytes((round(sr*a+dr*ia),round(sg*a+dg*ia),round(sb*a+db*ia),round(sa+da*ia)))
    def resize(self, size, resample=0):
        w,h=map(int,size); out=Image('RGBA',(w,h))
        for y in range(h):
            sy=min(self.height-1, y*self.height//h)
            for x in range(w):
                sx=min(self.width-1, x*self.width//w)
                out.data[(y*w+x)*4:(y*w+x+1)*4]=self.data[(sy*self.width+sx)*4:(sy*self.width+sx+1)*4]
        return out
    def tobytes(self): return bytes(self.data)
    def save(self, path):
        raw=b''.join(b'\x00'+self.data[y*self.width*4:(y+1)*self.width*4] for y in range(self.height))
        def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
        png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',self.width,self.height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
        with __builtins__['open'](path,'wb') as f: f.write(png)

def new(mode, size, color):
    if mode!='RGBA': raise NotImplementedError(mode)
    r,g,b,a=color
    return Image(mode,size,bytes((r,g,b,a))*(size[0]*size[1]))

def open(path):
    with __builtins__['open'](path,'rb') as f: data=f.read()
    if data[:8] != b'\x89PNG\r\n\x1a\n': raise ValueError('not png')
    pos=8; width=height=None; idat=[]; palette=None; trans=b''
    while pos < len(data):
        n=struct.unpack('>I',data[pos:pos+4])[0]; typ=data[pos+4:pos+8]; payload=data[pos+8:pos+8+n]; pos += 12+n
        if typ==b'IHDR': width,height,bit,color,_,_,_=struct.unpack('>IIBBBBB',payload)
        elif typ==b'PLTE': palette=[payload[i:i+3] for i in range(0,len(payload),3)]
        elif typ==b'tRNS': trans=payload
        elif typ==b'IDAT': idat.append(payload)
        elif typ==b'IEND': break
    raw=zlib.decompress(b''.join(idat)); src_bpp=1 if color==3 else 4; stride=width*src_bpp; rows=[]; prev=bytearray(stride); p=0
    for y in range(height):
        filt=raw[p]; p+=1; row=bytearray(raw[p:p+stride]); p+=stride
        for i in range(stride):
            left=row[i-src_bpp] if i>=src_bpp else 0; up=prev[i]; ul=prev[i-src_bpp] if i>=src_bpp else 0
            if filt==1: row[i]=(row[i]+left)&255
            elif filt==2: row[i]=(row[i]+up)&255
            elif filt==3: row[i]=(row[i]+((left+up)//2))&255
            elif filt==4:
                pr=left+up-ul; pa=abs(pr-left); pb=abs(pr-up); pc=abs(pr-ul); row[i]=(row[i]+(left if pa<=pb and pa<=pc else up if pb<=pc else ul))&255
        rows.append(bytes(row)); prev=row
    if color==6:
        out=b''.join(rows)
    elif color==3:
        out=bytearray()
        for row in rows:
            for idx in row:
                rgb=palette[idx] if palette and idx < len(palette) else b'\x00\x00\x00'
                a=trans[idx] if idx < len(trans) else 255
                out.extend(rgb+bytes((a,)))
    else:
        raise NotImplementedError(f'PNG color type {color}')
    return Image('RGBA',(width,height),out)
