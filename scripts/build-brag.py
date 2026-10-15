#!/usr/bin/env python3
"""BRAG-slim inspired, cost-free, reproducible public UI launch-film renderer.
Uses screenshots from the real Cloudflare Worker browser-acceptance workflow.
Never uses API keys or captures authenticated pages.
"""
from __future__ import annotations
import argparse, json, math, subprocess, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
W, H = 1280, 720

def main():
    a=argparse.ArgumentParser(); a.add_argument('--config', default='docs/brag.json'); a.add_argument('--screenshots',default='docs/demo-source'); a.add_argument('--output',default='docs/media'); args=a.parse_args()
    conf=json.loads((ROOT/args.config).read_text()); work=ROOT/'brag-output'/'work'; work.mkdir(parents=True,exist_ok=True)
    output=ROOT/args.output; output.mkdir(parents=True,exist_ok=True)
    shot_dir=ROOT/args.screenshots; name=conf['name']; desktop=Image.open(shot_dir/f'{name}-desktop-guest.png').convert('RGB'); mobile=Image.open(shot_dir/f'{name}-mobile-guest.png').convert('RGB');
    light=tuple(int(conf['accent'][i:i+2],16) for i in (1,3,5)); bg=tuple(int(conf['background'][i:i+2],16) for i in (1,3,5));
    bold=font('DejaVuSans-Bold.ttf',85); large=font('DejaVuSans-Bold.ttf',57); medium=font('DejaVuSans-Bold.ttf',30); regular=font('DejaVuSans.ttf',24); small=font('DejaVuSans.ttf',19); tiny=font('DejaVuSans.ttf',16)
    white=(245,247,255); muted=(160,172,192)
    def new(scene):
        im=Image.new('RGB',(W,H),bg); d=ImageDraw.Draw(im)
        for i in range(17):
            x=int(W*.75 + math.cos(i/2.7+scene)*i*10); y=int(H*.1+math.sin(i/4+scene)*i*17)
            col=tuple(int(bg[j]*(1-.09*(17-i)/17)+light[j]*(.09*(17-i)/17)) for j in range(3))
            d.ellipse((x-160-i*17,y-140-i*9,x+160+i*17,y+140+i*9),outline=col,width=2)
        d.rectangle((0,0,W,8),fill=light)
        d.text((72,42),'◈  '+name.upper(),font=medium,fill=white)
        d.text((W-210,50),f'{scene+1:02d} / 05',font=small,fill=muted)
        return im,d
    def label(d,s,x,y,large_label=False): d.text((x,y),s,font=medium if large_label else regular,fill=light)
    def browser(im,img,xy,wh):
        x,y=xy;w,h=wh;d=ImageDraw.Draw(im)
        d.rounded_rectangle((x-13,y-31,x+w+13,y+h+13),radius=18,fill=(37,44,61),outline=(73,82,105),width=2)
        d.rounded_rectangle((x-13,y-31,x+w+13,y+0),radius=15,fill=(37,44,61))
        for k,col in enumerate([(248,102,107),(250,191,69),(75,206,137)]):d.ellipse((x+7+k*19,y-19,x+17+k*19,y-9),fill=col)
        shot=Image.new('RGB',(w,h),bg); crop_h=min(img.height,round(img.width*h/w)); crop=img.crop((0,0,img.width,crop_h)).resize((w,h),Image.Resampling.LANCZOS)
        shot.paste(crop,(0,0));im.paste(shot,(x,y));
    def bottom(d,tag):
        d.line([(70,654),(1210,654)],fill=(68,79,101),width=2)
        d.text((72,665),tag.upper(),font=tiny,fill=muted)
        d.text((1060,665),'CLOUDFLARE  /  GITHUB',font=tiny,fill=muted,anchor='la')
    # 00: hook with real UI
    im,d=new(0);d.text((72,113),conf['hook'],font=large,fill=white);d.text((74,194),conf['subhook'],font=regular,fill=muted)
    browser(im,desktop,(94,268),(1092,339));bottom(ImageDraw.Draw(im),'LIVE PRODUCT  •  ILLUSTRATIVE GUEST DATA');im.save(work/'scene0.png')
    # 01: focused flagship
    im,d=new(1);label(d,'01  /  THE PRODUCT',73,122);d.text((72,167),conf['feature1'],font=large,fill=white)
    browser(im,desktop,(101,275),(1078,326));bottom(ImageDraw.Draw(im),'CAPTURED FROM PUBLIC CLOUDFLARE DEPLOYMENT');im.save(work/'scene1.png')
    # 02: detail, product-specific engineering
    im,d=new(2);label(d,'02  /  ENGINEERING',73,125);d.text((72,172),conf['feature2'],font=large,fill=white)
    browser(im,desktop,(80,270),(780,315));d.rounded_rectangle((894,286,1211,586),radius=18,fill=(27,38,50),outline=light,width=2)
    for idx,line in enumerate(conf['proof']):d.text((921,322+idx*68),('✓  '+line),font=small,fill=white)
    bottom(d,'TESTED IN GITHUB ACTIONS  /  BOUNDED FREE USAGE');im.save(work/'scene2.png')
    # 03: responsive live UI
    im,d=new(3);label(d,'03  /  LIVE EXPERIENCE',73,120);d.text((72,167),conf['mobileTitle'],font=large,fill=white)
    for i,line in enumerate(conf['mobileLines']):d.text((75,290+i*47),line,font=regular,fill=muted)
    phone=mobile.copy(); phone.thumbnail((250,485),Image.Resampling.LANCZOS)
    d.rounded_rectangle((881,130,1185,646),radius=37,fill=(16,22,33),outline=(87,98,119),width=5)
    im.paste(phone,(908+(250-phone.width)//2,151)); bottom(d,'DESKTOP + MOBILE  /  GUEST PREVIEW');im.save(work/'scene3.png')
    # 04: close
    im,d=new(4);d.text((73,153),conf['closing'],font=large,fill=white)
    d.text((74,265),conf['closingLine'],font=regular,fill=muted)
    d.rounded_rectangle((74,394,766,505),radius=18,fill=(29,41,52),outline=light,width=3)
    d.text((104,426),'EXPLORE THE LIVE APPLICATION  →',font=medium,fill=white)
    d.text((76,557),'github.com/amiddlebrook/'+name,font=regular,fill=muted)
    bottom(d,'BRAG-SLIM STORYBOARD  /  REAL UI  /  NO PAID SERVICES');im.save(work/'scene4.png')
    Image.open(work/'scene0.png').convert('RGB').save(output/'brag-poster.jpg',quality=88,optimize=True)
    # Assemble 5 animated four-second scenes with subtle emphasis motion
    ffmpeg=os.environ.get('FFMPEG_BIN','ffmpeg');pieces=[]
    for i in range(5):
        dest=work/f'segment{i}.mp4';pieces.append(dest)
        filtergraph="zoompan=z='min(zoom+0.00035,1.043)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=96:s=1280x720:fps=24,format=yuv420p"
        cmd=[ffmpeg,'-hide_banner','-loglevel','error','-y','-loop','1','-i',str(work/f'scene{i}.png'),'-vf',filtergraph,'-frames:v','96','-an','-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p',str(dest)]
        subprocess.run(cmd,check=True)
    listing=work/'concat.txt';listing.write_text(''.join('file '+repr(str(p))+'\n' for p in pieces))
    # Subtle original synthesis: no stock/licensed music or paid provider
    tones=[]
    for frequency in (110,164.81,220,329.63): tones.extend(['-f','lavfi','-i',f'sine=frequency={frequency}:sample_rate=44100:duration=20'])
    audio=work/'audio.m4a'
    mix=''.join(f'[{i}:a]volume={0.045 if i==0 else 0.022}[a{i}];' for i in range(4))+''.join(f'[a{i}]' for i in range(4))+'amix=inputs=4:normalize=0,lowpass=f=1550,afade=t=in:st=0:d=1,afade=t=out:st=18:d=2[out]'
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y',*tones,'-filter_complex',mix,'-map','[out]','-c:a','aac','-b:a','112k',str(audio)],check=True)
    joined=work/'video.mp4';subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(listing),'-c','copy',str(joined)],check=True)
    movie=output/'brag.mp4';subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(joined),'-i',str(audio),'-map','0:v','-map','1:a','-c:v','copy','-c:a','copy','-movflags','+faststart','-shortest',str(movie)],check=True)
    # Lightweight inline motion preview. MP4 is the actual deliverable.
    preview=output/'brag-preview.gif';subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-ss','0','-t','7','-i',str(movie),'-vf','fps=6,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer','-loop','0',str(preview)],check=True)
    (output/'share-copy.txt').write_text(conf['share']+'\n')
    print(json.dumps({'app':name,'mp4_bytes':movie.stat().st_size,'gif_bytes':preview.stat().st_size,'poster_bytes':(output/'brag-poster.jpg').stat().st_size,'duration_s':20,'source':'live Cloudflare guest screenshots'}))

def font(file,size):
    for path in [f'/usr/share/fonts/truetype/dejavu/{file}',f'/usr/share/fonts/truetype/liberation2/{file}']:
        if Path(path).exists():return ImageFont.truetype(path,size)
    return ImageFont.load_default(size=size)
if __name__=='__main__':main()
