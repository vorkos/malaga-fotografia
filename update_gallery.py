with open('index.html', 'rb') as f:
    b = f.read()

VS = b'display:block;width:100%;aspect-ratio:4 / 5;object-fit:cover;border-radius:2px;'
HS = b'display:block;width:100%;aspect-ratio:3 / 2;object-fit:cover;border-radius:2px;'

def tag(file, style):
    return b'<img src=\x5c"/gallery/' + file.encode() + b'\x5c" alt=\x5c"\x5c" style=\x5c"' + style + b'\x5c">'

def swap(content, old_f, new_f, style):
    old = tag(old_f, style)
    new = tag(new_f, style)
    if old not in content:
        print(f'MISS: {old_f}')
        return content
    print(f'OK: {old_f} -> {new_f}')
    return content.replace(old, new, 1)

# ORDER: replace SOURCE slots first to avoid collisions when a photo moves positions

# --- Remove photos that are moving to different slots first ---
# p2g2: Z52_0537 -> Z52_1820  (Z52_0537 is the new g1)
b = swap(b, 'Z52_0537-small.jpg', 'Z52_1820-small.jpg', VS)
# p3g6: Z52_0461 -> Z52_2638  (Z52_0461 is the new g5)
b = swap(b, 'Z52_0461.jpg', 'Z52_2638-small.jpg', HS)
# p3g1: Z52_0501 -> Z52_9385  (Z52_0501 is the new p3g4)
b = swap(b, 'Z52_0501.jpg', 'Z52_9385-small.jpg', VS)

# --- Now do all remaining replacements ---
# Page 1 verticals
b = swap(b, 'Z52_0012-small.jpg', 'Z52_0537-small.jpg', VS)  # g1
b = swap(b, 'Z52_0147-small.jpg', 'Z52_1162-small.jpg', VS)  # g2
b = swap(b, 'Z52_0598-small.jpg', 'Z52_1652-small.jpg', VS)  # g3
b = swap(b, 'Z52_0600-small.jpg', 'Z52_0924.jpg',       VS)  # g4
# Page 1 horizontals (do g5 before g6 since Z52_0383 moves from g5 to g6)
b = swap(b, 'Z52_0383.jpg',       'Z52_0461.jpg',       HS)  # g5
b = swap(b, 'Z52_0407.jpg',       'Z52_0383.jpg',       HS)  # g6
# Page 2 verticals
b = swap(b, 'Z52_0528-small.jpg', 'Z52_1917-small.jpg', VS)  # p2g1
b = swap(b, 'Z52_0538-small.jpg', 'Z52_2867-small.jpg', VS)  # p2g3
b = swap(b, 'Z52_0549-small.jpg', 'Z52_9094-small.jpg', VS)  # p2g4
# Page 2 horizontals
# p2g5: Z52_0431 stays same — skip
b = swap(b, 'Z52_0441.jpg',       'Z52_9440-small.jpg', HS)  # p2g6
# Page 3 verticals
b = swap(b, 'Z52_0515.jpg',       'Z52_7655-small.jpg', VS)  # p3g2
b = swap(b, 'Z52_0561.jpg',       'Z52_6186_DxO-small.jpg', VS)  # p3g3
# p3g4: replace Z52_0569 (V style only — about-portrait has different style)
b = swap(b, 'Z52_0569.jpg',       'Z52_0501.jpg',       VS)  # p3g4
# Page 3 horizontals
b = swap(b, 'Z52_0446.jpg',       'Z52_9221-small.jpg', HS)  # p3g5

# --- Inject randomizer script before </body> ---
RANDOMIZER = b"""
<script>
(function(){
var V=['Z52_0501.jpg','Z52_0537-small.jpg','Z52_1336.jpg','Z52_1162-small.jpg','Z52_1652-small.jpg','Z52_0924.jpg','Z52_1917-small.jpg','Z52_1820-small.jpg','Z52_2867-small.jpg','Z52_6186_DxO-small.jpg','Z52_9933-small.jpg','Z52_9385-small.jpg','Z52_9094-small.jpg','Z52_7655-small.jpg','Z52_2868-small.jpg','Z52_9756-small.jpg','Z52_9652-small.jpg','Z52_9480-small.jpg','Z52_9287-small.jpg','Z52_7827-small.jpg','Z52_7622-small.jpg','Z52_7547-small_2.jpg','Z52_0012-small.jpg','Z52_0515.jpg','Z52_0561.jpg','Z52_0631.jpg','Z52_9457-small.jpg','Z52_9087-small.jpg','Z52_8190_1-small.jpg'];
var H=['Z52_0461.jpg','Z52_0431.jpg','Z52_0383.jpg','Z52_9440-small.jpg','Z52_9221-small.jpg','Z52_2638-small.jpg','Z52_9471-small_1.jpg','Z52_0441.jpg','Z52_0446.jpg','Z52_2637-small.jpg','Z52_2615-small.jpg'];
function sh(a){a=[].concat(a);for(var i=a.length-1;i>0;i--){var j=0|Math.random()*(i+1);var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function run(){
  var track=document.getElementById('pf-track');
  if(!track)return false;
  var vi=[],hi=[];
  track.querySelectorAll('img').forEach(function(img){
    var s=img.getAttribute('style')||'';
    if(s.indexOf('4 / 5')>-1)vi.push(img);
    else if(s.indexOf('3 / 2')>-1)hi.push(img);
  });
  if(vi.length<12||hi.length<6)return false;
  var sv=sh(V),sh2=sh(H);
  vi.forEach(function(img,i){if(sv[i])img.src='/gallery/'+sv[i];});
  hi.forEach(function(img,i){if(sh2[i])img.src='/gallery/'+sh2[i];});
  return true;
}
if(!run()){var obs=new MutationObserver(function(){if(run())obs.disconnect();});obs.observe(document.body,{childList:true,subtree:true});setTimeout(function(){obs.disconnect();},8000);}
})();
</script>
"""

if b'</body>' in b:
    b = b.replace(b'</body>', RANDOMIZER + b'</body>', 1)
    print('Randomizer injected before </body>')
else:
    print('WARNING: </body> not found — appending at end')
    b += RANDOMIZER

with open('index.html', 'wb') as f:
    f.write(b)
print('Done')
