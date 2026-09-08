"""
================================================================
01_prepare_dataset.py  —  Phase 3.1
Multilingual Dataset Preparation + Balancing + Label Validation
================================================================

Features:
✅ Loads CSV / JSONL datasets (or generates realistic synthetic Tagalog/English demo)
✅ 1:1 preprocessing (matches Next.js + FastAPI server exactly)
✅ Language detection + filter (Tagalog / English only)
✅ Label validation + quality checks
✅ Train / Val / Test split (reproducible)
✅ Class balancing (class weights + optional SMOTE-text augmentation)
✅ Prints full dataset report (counts, percentages, avg length per class)
✅ Saves: train.csv, val.csv, test.csv, dataset_report.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

from tqdm import tqdm

tqdm.pandas()

# ------------------------------
# PATHS & CONSTANTS
# ------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUT_DIR = BASE_DIR / "outputs"
LOG_DIR = BASE_DIR / "logs"
for d in (DATA_DIR, OUT_DIR, LOG_DIR):
    d.mkdir(parents=True, exist_ok=True)

LABELS = ["positive", "negative", "distress"]
LABEL2IDX = {l: i for i, l in enumerate(LABELS)}
RANDOM_SEED = 42


# ------------------------------
# PREPROCESSING (MUST MATCH NEXT.JS + SERVER!)
# ------------------------------
URL_RE = re.compile(r"https?://[^\s]+")
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
HTML_RE = re.compile(r"<[^>]*>")
WS_RE = re.compile(r"\s+")


def preprocess(text: str) -> str:
    if not isinstance(text, str):
        return ""
    t = text.strip()
    t = WS_RE.sub(" ", t)
    t = unicodedata.normalize("NFC", t)
    t = HTML_RE.sub(" ", t)
    t = URL_RE.sub(" ", t)
    t = EMAIL_RE.sub(" ", t)
    return t.strip()


# ------------------------------
# LANGUAGE DETECT (lightweight, keyword-based for TL/EN)
# ------------------------------
TAGALOG_COMMON = set(
    "ang mga ng sa ay na ng ko ko na si niya ako ikaw at o pero dahil kung habang "
    "marami tao masaya malungkot lungkot sakit problema bigla pakiramdam nag-aalala "
    "natatakot awa tuwa galit stress pagod mahirap saya mahalaga gusto kailangan "
    "ayoko gusto pamilya kaibigan paaralan trabaho buhay araw gabi ngayon kahapon "
    "bukas sana naman talaga siguro pwede hindi oo laging minsan".split()
)


def detect_lang_taglish(text: str) -> str:
    """Very lightweight Tagalog vs English detector. Returns 'tl', 'en', or 'mixed'."""
    words = re.findall(r"[A-Za-z]+", text.lower())
    if not words:
        return "unknown"
    tl_hits = sum(1 for w in words if w in TAGALOG_COMMON)
    if tl_hits >= 2:
        return "tl" if (tl_hits / len(words)) >= 0.25 else "mixed"
    return "en"


# ------------------------------
# LABEL VALIDATION
# ------------------------------
VALID_LABEL_ALIASES = {
    "positive": {"pos", "positive", "good", "masaya", "happy", "joy", 0, "0"},
    "negative": {"neg", "negative", "bad", "sad", "malungkot", "lungkot", 1, "1"},
    "distress": {
        "dst",
        "distress",
        "crisis",
        "critical",
        "suicidal",
        "self-harm",
        "selfharm",
        "danger",
        "emergency",
        2,
        "2",
    },
}


def normalize_label(raw) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, float) and np.isnan(raw):
        return None
    if isinstance(raw, (int,)) and 0 <= raw <= 2:
        return LABELS[raw]
    s = str(raw).strip().lower()
    for canon, aliases in VALID_LABEL_ALIASES.items():
        if s in aliases:
            return canon
    return None  # Invalid


# ------------------------------
# SYNTHETIC DATASET GENERATOR (for DEMO if no real data provided!)
# ------------------------------
SYNTH = {
    "positive": [
        # ── English ───────────────────────────────────────────────────────────
        "I feel so happy and grateful for everything today.",
        "Spent a wonderful day with my family and loved ones.",
        "Finally finished my project! Proud of my progress.",
        "My friends surprised me today — it was amazing!",
        "Little wins make me realize life is beautiful.",
        "I am so thankful for my support system.",
        "Great workout and productive morning overall.",
        "Everything is going well. I feel calm and at peace.",
        "Got accepted! My hard work really paid off.",
        "Grateful for another chance to be alive and healthy.",
        "Woke up feeling refreshed and ready to take on the day.",
        "I passed my exam and I could not be more relieved and happy.",
        "My mentor gave me really encouraging feedback today.",
        "Reconnected with an old friend and it felt so good.",
        "I cooked a meal from scratch and it actually tasted amazing.",
        "Feeling optimistic about the future for the first time in a while.",
        "Small acts of kindness from strangers lifted my mood today.",
        "I finally started that hobby I kept putting off — feels great.",
        "My team supported me through a tough presentation and we nailed it.",
        "Celebrated a small milestone and it reminded me how far I have come.",
        "I feel proud of myself for getting through a difficult week.",
        "Journaling every day has genuinely improved my mental clarity.",
        "Today was simple but peaceful. That is enough for me.",
        "I received a kind message from a friend out of nowhere.",
        "My anxiety was low today and I felt like myself again.",
        "I smiled more today than I have in a long time.",
        "Got promoted at work after months of hard effort.",
        "My family called just to check on me — felt really loved.",
        "Finished a book I have been meaning to read for years.",
        "Feeling content. Not everything has to be perfect to be good.",
        "I helped someone today and it gave me a genuine sense of purpose.",
        "The sunrise this morning made me feel grateful to be alive.",
        "I finally forgave myself for a past mistake. It feels lighter.",
        "Had a deep honest conversation with someone I trust.",
        "My hard work is slowly paying off and I can feel the momentum.",
        "Today I chose to focus on what I can control, and it helped.",
        "I went for a walk and it completely reset my mood.",
        "Feeling energized and ready to tackle my goals.",
        "I love the progress I am making even if it is slow.",
        "Things are not perfect but I am genuinely doing better.",
        # ── English — batch 2 ─────────────────────────────────────────────────
        "Today felt like a fresh start and I am embracing it.",
        "I feel safe and loved and that means everything right now.",
        "I accomplished something I have been putting off for months.",
        "The conversation I had today left me feeling understood.",
        "I feel light. Like a weight I did not even notice has been lifted.",
        "My heart is full from a really meaningful day.",
        "I handled a difficult situation calmly and I am proud of that.",
        "I woke up and the first thing I felt was gratitude.",
        "Everything aligned today in a way that felt almost magical.",
        "I feel more confident in who I am than I ever have.",
        "I found peace in being still and doing absolutely nothing.",
        "Checked in with myself today and I am genuinely doing okay.",
        "I trusted my instincts and it worked out perfectly.",
        "I feel connected to something bigger than myself today.",
        "Had the most healing conversation with my best friend.",
        "I realized I do not need to have everything figured out to be happy.",
        "My body felt strong during my workout today and I loved it.",
        "The weather matched my mood — sunny and warm.",
        "I made someone else smile today and it made my whole day.",
        "I am grateful for the ordinary moments that make life worth living.",
        "I spent the morning outside and felt completely recharged.",
        "I finished something creative and it felt deeply satisfying.",
        "I spoke honestly about my feelings and was met with kindness.",
        "I feel hopeful about where my life is going.",
        "I let go of something I was holding onto too tightly.",
        "I slept deeply and woke up feeling genuinely restored.",
        "A random act of kindness today reminded me people are good.",
        "I took a risk and it paid off in the best way.",
        "I am learning to enjoy the process rather than just the outcome.",
        "I feel stable, grounded, and ready for whatever comes next.",
        "My relationships feel healthy and reciprocal right now.",
        "I feel at home in my own skin today.",
        "I am proud of the person I am becoming.",
        "I gave myself grace today instead of criticism.",
        "I reached out to someone who needed support and it felt good.",
        "I feel motivated not from pressure but from genuine desire.",
        "I did something kind for myself today without guilt.",
        "I caught myself smiling for no reason at all.",
        "I feel like the best version of myself is starting to show up.",
        "I am exactly where I need to be right now.",
        "Today I chose joy intentionally and it made a difference.",
        "I feel a quiet excitement about the future.",
        "I am healing and I can feel it.",
        "I have everything I need in this moment.",
        "I feel worthy of good things happening to me.",
        "I reconnected with a part of myself I thought was lost.",
        "I danced around my room tonight and felt completely free.",
        "I am building a life that actually feels like mine.",
        "I feel genuinely proud of how far I have come.",
        "Today reminded me that good people exist everywhere.",
        "I made a healthy choice today and felt great about it.",
        "I finished the week strong and I am celebrating that.",
        "I feel steady even when things around me are uncertain.",
        "I cried happy tears today because something good finally happened.",
        "I feel whole.",
        "I achieved a goal I set for myself six months ago.",
        "I woke up excited about the day ahead for the first time in a while.",
        "I feel nourished — by food, by rest, and by connection.",
        "I overcame a fear today and it was one of the best feelings.",
        "I feel genuinely content with the simple life I have built.",
        "A hug from someone I love today made everything feel okay.",
        "I feel balanced — not perfect, but balanced.",
        "I am grateful for my health, my mind, and my spirit.",
        "I created something today that I am genuinely proud of.",
        "I feel patient with myself in a way I never used to.",
        "I said yes to something new and it opened a door I did not expect.",
        "I am not chasing happiness. Today I just felt it.",
        "I feel capable of handling whatever comes my way.",
        "The people in my corner are incredible and I felt that today.",
        "I feel joyful, grateful, and at peace all at once.",
        "I finished a really hard chapter and I came out stronger.",
        "I feel loved and I am learning to receive it without guilt.",
        "The world felt kind to me today.",
        "I am choosing to believe things will keep getting better.",
        "I feel awake in a way that has nothing to do with sleep.",
        "I had a moment of pure joy today and held onto it.",
        "I feel like I belong — to myself, to my people, to this life.",
        # ── English — batch 3 ─────────────────────────────────────────────────
        "My day was not exciting but I felt deeply peaceful throughout.",
        "I stopped comparing myself to others and instantly felt lighter.",
        "I sent a thank-you message and the reply made me cry happy tears.",
        "I cleaned my space and my mind followed.",
        "I chose kindness over being right today and I do not regret it.",
        "I feel genuinely excited about my future for the first time.",
        "I completed a challenge I thought was beyond me.",
        "I feel supported in every direction I turn.",
        "I took care of my body today and it thanked me for it.",
        "I feel abundant — not in money, but in meaning.",
        "I am learning to trust myself more and it feels good.",
        "I had a quiet, beautiful evening and felt fully present.",
        "I feel like things are finally clicking into place.",
        "I got through a hard conversation and came out closer to that person.",
        "I woke up naturally before my alarm and felt ready.",
        "My creativity flowed today without force.",
        "I feel anchored by the people and values I hold close.",
        "I journaled tonight and realized how much has improved.",
        "I received news that made me genuinely jump for joy.",
        "I am so glad I chose to keep going.",
        "I feel like a seed that has finally started to grow.",
        "I took the long way home just to enjoy the walk.",
        "I feel proud of how I handled conflict with patience today.",
        "I realized I am more resilient than I ever gave myself credit for.",
        "I feel at ease with who I am and where I am headed.",
        "I stopped people-pleasing today and stood by my own choices.",
        "I feel nurtured by the routines I have built for myself.",
        "I gave someone an honest compliment and it brightened both our days.",
        "I feel like the version of me I always wanted to be.",
        "I took a nap without guilt and woke up refreshed.",
        "I feel inspired and I have not felt that in a long time.",
        "I finished a project that pushed every limit I had.",
        "I asked for what I needed and it was given freely.",
        "I feel safe to be my authentic self around the people I love.",
        "I spent the day doing what I love with no agenda.",
        "I am grateful for challenges because they showed me my strength.",
        "I feel more myself with every passing day.",
        "I made a choice today that aligned with my values.",
        "I feel clear-headed, motivated, and purposeful.",
        "I shared something personal and was met with acceptance.",
        "Today I woke up and thought — I am glad I am alive.",
        "I crossed something off my bucket list today.",
        "I feel like the universe is working in my favor.",
        "I prioritized myself today and it was the right call.",
        "I feel empowered by the choices I have been making.",
        "I feel deeply loved by the right people.",
        "I was honest with someone and it brought us closer.",
        "I feel alive in the best possible way.",
        "I am grateful for my journey even on the hard days.",
        "I created a calm morning routine that I actually look forward to.",
        # ── English — batch 4 (student and young adult context) ───────────────
        "I got my essay back and the grade was better than I expected.",
        "My professor told me she sees real potential in me.",
        "I finally made friends in a class I was dreading.",
        "I survived midterms and treated myself to my favorite meal.",
        "I got accepted into the internship I wanted.",
        "I stayed late to finish an assignment and actually felt proud.",
        "I presented in front of the class and did not freeze.",
        "I joined a new student org and felt instantly welcomed.",
        "I paid my bills on time this month and felt so capable.",
        "I cooked a real meal instead of instant noodles and it was great.",
        "I organized my entire study schedule and feel in control.",
        "I helped a classmate understand a topic and it felt rewarding.",
        "I did not procrastinate today and the relief was incredible.",
        "I called home and my parents were so proud of me.",
        "I got feedback that I improved significantly.",
        "I showed up for a friend who needed me and felt good about it.",
        "I landed a part-time job I actually care about.",
        "I finished my thesis outline and it finally made sense.",
        "I feel proud of myself for adulting well today.",
        "I saved money this week and felt genuinely responsible.",
        # ── English — batch 5 (recovery and mental wellness) ──────────────────
        "My therapist said she can see real growth in me.",
        "I went a whole week without an anxiety spiral.",
        "I recognized a thought pattern and redirected it.",
        "I used a coping skill that actually worked today.",
        "I feel proud of how far my mental health has come.",
        "I reached out for help and I am so glad I did.",
        "I slept seven hours straight for the first time in months.",
        "I ate three meals today and that is a win.",
        "I did not cancel plans today and I am happy I went.",
        "I chose rest instead of pushing through and it was the right call.",
        "I recognized an anxiety trigger and handled it well.",
        "I am learning that healing is not linear and I am okay with that.",
        "I did a breathing exercise and my body actually calmed down.",
        "I set a boundary and the world did not end.",
        "I feel emotionally regulated today and it feels new.",
        "I let myself feel sad, and then I let it pass.",
        "I did not isolate today even when I wanted to.",
        "I feel resilient in a way I have worked hard to earn.",
        "I am comfortable with uncertainty in a way I never used to be.",
        "I feel hopeful about my mental health journey.",
        # ── English — extended ────────────────────────────────────────────────
        "I feel genuinely at peace with where I am right now.",
        "Had a really meaningful conversation with my mom tonight.",
        "I finished all my tasks and treated myself to a nice dinner.",
        "I feel seen and understood by the people in my life.",
        "Signed up for a new class and I am actually excited.",
        "My confidence has been growing steadily these past few weeks.",
        "Had a full night of sleep and woke up feeling completely renewed.",
        "I am starting to believe in myself again.",
        "Today I noticed beauty in the small ordinary things.",
        "Feeling lighter than I have in months. Something shifted.",
        "I laughed so hard today, it felt really healing.",
        "My relationship with my sibling is so much better lately.",
        "I got honest feedback and chose to grow from it instead of crumble.",
        "The therapy session today gave me so much clarity.",
        "I realized I have come so much further than I give myself credit for.",
        "I am sleeping better and my mood reflects it.",
        "Set a personal boundary today and it felt empowering.",
        "Feeling hopeful about a new opportunity I am pursuing.",
        "I donated to a cause I care about and it felt meaningful.",
        "Started my morning with gratitude and it set the whole tone for the day.",
        "I spoke kindly to myself today instead of being my own worst critic.",
        "The people in my life genuinely care about me and I feel it.",
        "I found a creative outlet that brings me real joy.",
        "Feeling grounded. No big highs or lows, just steady and okay.",
        "I acknowledged my feelings instead of pushing them away and it helped.",
        "Made peace with something I could not change. Big relief.",
        "I finally let go of something that was weighing me down.",
        "Feeling inspired after reading something that resonated deeply.",
        "A stranger smiled at me and it genuinely made my day better.",
        "I made a decision I was afraid of and it went really well.",
        "Showed up for myself today even when I did not feel like it.",
        "I appreciated my own growth when I looked back at old journal entries.",
        "Feeling motivated and focused without any pressure. Just flow.",
        "My heart feels full after spending quality time with people I love.",
        "I am proud of myself for asking for help when I needed it.",
        "Today was a 10 out of 10. Not because everything was perfect but because I was present.",
        "I am learning to be okay with not having all the answers.",
        "Felt true joy today — the kind that comes from doing what you love.",
        "Something shifted in me today. I finally feel ready.",
        "The world feels a little more manageable when I take things one step at a time.",
        # ── Tagalog / Taglish ────────────────────────────────────────────────
        "Sobrang saya ko ngayong araw na ito, maraming salamat sa lahat.",
        "Masayang kasama ang pamilya ngayong weekend.",
        "Matagumpay kong natapos ang aking mga gawain, proud ako!",
        "Binigyan ako ng surprise ng mga kaibigan ko — sobrang saya!",
        "Dahil sa maliliit na tagumpay, ramdam ko ang ganda ng buhay.",
        "Salamat sa Panginoon sa biyayang natanggap ko ngayon.",
        "Maganda ang pakiramdam ko pagkatapos mag-ehersisyo.",
        "Maayos ang lahat sa araw na ito, payapa ang isip ko.",
        "Pumasa ako sa pagsusulit! Sulit ang lahat ng pagod ko.",
        "Salamat sa panibagong araw na mabuti at malusog ang kalagayan ko.",
        "Nag-uusap kami ng pamilya namin ngayong gabi at masaya talaga.",
        "Natupad ko na ang isang pangarap ko — parang hindi pa rin totoo.",
        "Nakakuha ako ng positibong feedback mula sa aking guro ngayon.",
        "Nakaramdam ako ng tunay na kaginhawaan pagkatapos ng mahabang araw.",
        "Nagsimula na ako ng bagong hobby at sobrang saya ng feeling.",
        "Ramdam ko ang pagmamahal ng aking mga mahal sa buhay ngayon.",
        "Masaya ako kahit maliit lang ang nangyari ngayon — sapat na.",
        "Nakakatulong ako sa kapwa at nakaramdam ako ng tunay na layunin.",
        "Ang simpleng araw ngayon ay nagbigay sa akin ng kapayapaan.",
        "Slowly pero siguradong nag-iimprove na ang kalagayan ko.",
        "Nagpasalamat ako ngayon sa kahit na maliliit na bagay.",
        "Natulog nang maayos at gumising nang masaya at puno ng lakas.",
        "Pinuri ako ng aking boss sa trabaho ngayon — sobrang inspiring!",
        "Naramdaman ko ang tunay na kasiyahan habang nagpe-pray ngayong umaga.",
        "Kaya ko pala ang mga bagay na akala ko ay imposible — proud ako.",
        "Kahit mahirap ang buhay, may dahilan pa rin akong mag-smile ngayon.",
        "Natuwa ang aking puso sa simpleng mensahe ng aking kaibigan.",
        "Ramdam ko na okay na ang lahat kahit hindi pa perpekto.",
        "Puno ng pasasalamat ang puso ko ngayong araw na ito.",
        "Napatunayan ko sa sarili ko na kaya ko pa — at masaya ako doon.",
        # ── Tagalog / Taglish — extended ─────────────────────────────────────
        "Grabe yung feeling pag naabot mo yung isang bagay na matagal mo nang pinapangarap.",
        "Kumain kami ng pamilya sa labas ngayon — simpleng saya pero sobrang saya.",
        "Natapos ko na ang isang mahirap na chapter ng buhay ko at excited na ako sa susunod.",
        "Dumating ang magandang balita ngayon at napangiti talaga ako nang malalim.",
        "Naka-appreciate ako ng maliliit na bagay ngayon at naging maganda ang araw ko.",
        "Nagsimula akong mag-journal at parang nakakatulong talaga sa pag-iisip ko.",
        "Naniwala ako sa sarili ko kahit mahirap at naging okay naman ang lahat.",
        "Naramdaman ko yung tunay na pagmamahal ng pamilya ko ngayong gabi.",
        "Masaya at payapa ang puso ko ngayong araw, walang ibang gusto.",
        "Kahit maliit lang yung achievement, proud pa rin ako sa sarili ko.",
        "Ang gaan ng feeling ko ngayon — parang nabunutan ng tinik ang dibdib ko.",
        "Nag-thank you ako sa sarili ko ngayon para sa lahat ng pinagdaanan ko.",
        "Nalaman ko na kaya ko palang harapin ang mga bagay na takot na takot ako dati.",
        "Natawa ako nang tunay ngayon — yung klase ng tawang healing talaga.",
        "Pumunta sa simbahan at nakaramdam ng kapayapaan na matagal ko nang hinahanap.",
        "Nagtanim ng halaman at parang nagpapaalaala sa akin na kaya ko rin lumago.",
        "Nag-exercise ako kahit ayaw ko at after ay ang gaan ng pakiramdam ko.",
        "Binigyan ako ng pagkakataon na lumagpas sa takot ko at nag-work out naman.",
        "Nagpadala ng mensahe sa isang kaibigan at nag-reconnect kami — masaya ang puso ko.",
        "Tinanggap ko ang mga pagkakamali ko at pinili kong lumago mula roon.",
        # ── Tagalog / Taglish — batch 2 ───────────────────────────────────────
        "Ngayon ay isa sa mga pinakamababang araw ng buhay ko — sa magandang paraan.",
        "Napag-usapan namin ang lahat at naramdaman kong lubos na nauunawaan.",
        "Ang tagumpay ngayon ay resulta ng lahat ng pagod ko — worth it.",
        "Masaya ako ngayon dahil pinili ko ang sarili ko.",
        "Naramdaman ko ang ganda ng simpleng pamumuhay ngayon.",
        "Nagpapasalamat ako sa bawat tao na nanatili sa tabi ko.",
        "Natutunan ko ngayon na kaya ko pala ang mga bagay na akala ko ay hindi.",
        "Ang magandang balita ngayon ay nagpapasaya ng buong puso ko.",
        "Sobrang happy ko sa resulta ng aking pagsisikap ngayon.",
        "Natawa ako nang totohanin ngayong gabi at nakaramdam ng gaan.",
        "Nakapag-pahinga ako nang maayos at nararamdaman ko ang pagbabago.",
        "Naging mapagpasensya ako sa sarili ko ngayon at iba ang feeling.",
        "Naramdaman ko na kaya kong harapin ang kahit anong hamon.",
        "Nagpapasalamat ako sa mabuting kalusugan na mayroon ako ngayon.",
        "Ang araw ngayon ay punong-puno ng magagandang sorpresa.",
        "Natuklasan ko ang isang bagay tungkol sa sarili ko na nagpapasaya sa akin.",
        "Natapos ko ang isang bagay na matagal ko nang gustong gawin.",
        "Nakaramdam ako ng tunay na kasiyahan habang nakikinig sa musika ngayong hapon.",
        "Puno ng pag-asa ang puso ko para sa kinabukasan ko.",
        "Pinili ko ang kaligayahan ngayon kahit mahirap — at naramdaman ko ito.",
        "Nagulat ako sa sarili ko kung gaano kalaki ang pagbabago sa akin.",
        "Naramdaman ko ang suporta ng aking pamilya at hindi ko kayang i-describe ang feeling.",
        "Nag-aral ako nang mabuti at naramdaman ko ang satisfaction nang matapos.",
        "Binago ko ang aking mindset ngayon at iba talaga ang resulta.",
        "Naging buo ang aking araw dahil sa simpleng ngiti ng isang kaibigan.",
        "Natuklasan ko ang isang bagong passion at excited na akong tuklasin ito.",
        "Nakapag-tulong ako sa pamilya ko ngayon at naramdaman ko ang tunay na layunin.",
        "Mahal ko ang buhay ko ngayon — hindi perpekto pero mahal ko pa rin.",
        "Nag-pray ako ngayong umaga at naramdaman ko ang kapayapaan buong araw.",
        "Naabot ko ang isang milestone ngayon na matagal ko nang pinagtatrabahuhan.",
        # ── Tagalog / Taglish — batch 3 ───────────────────────────────────────
        "Grabe ang saya ko ngayon — parang lahat ay nagtutulungan para maging okay.",
        "Natuwa ako sa simpleng bagay ngayon at naramdaman ko ang ganda ng buhay.",
        "May nagsabi sa akin ng magandang salita ngayon at hanggang ngayon ay nararamdaman ko pa.",
        "Natapos na ang mahabang panahon ng paghihirap at nagsisimula na akong huminga.",
        "Naramdaman ko ang tunay na pagmamahal ngayon mula sa mga taong nagmamalasakit sa akin.",
        "Naging matapang ako ngayon para gawin ang bagay na dati ay takot na takot ako.",
        "Masaya akong kasama ang sarili ko ngayon — parang okay na ang lahat.",
        "Natupad ko ang isang pangako ko sa sarili ko at proud ako.",
        "Naramdaman ko na sumusulong na ang buhay ko sa tamang direksyon.",
        "Nagpahinga ako ngayon nang walang guilt at naging mas maayos ang buong araw.",
        "Nagsimula akong mag-grateful journal at nag-iiba na ang perspektibo ko sa buhay.",
        "Natutuwa ako sa maliliit na bagay ngayon — ang kape, ang sikat ng araw, ang ngiti.",
        "Naramdaman ko na kaya kong pangalagaan ang sarili ko nang maayos.",
        "Naging maayos ang lahat ng plano ko ngayon at naramdaman ko ang kontrol.",
        "Nagpasalamat ako sa isang tao ngayon at nakita ko ang natuwa sa kanyang mukha.",
        "Nakatanggap ako ng magandang balita mula sa paaralan at nag-celebrate kami ng pamilya.",
        "Nag-improve ang aking kalagayan at ramdam ko ito sa katawan ko.",
        "Naging produktibo ako ngayon nang hindi naman pinilit at masayang-masaya ako.",
        "Naramdaman ko ang pagmamahal sa sarili sa unang pagkakataon — at maganda ang feeling.",
        "Nagpahinga muna ako ngayon at hindi ko pagsisisihan — kailangan ko talaga iyon.",
        # ── Tagalog / Taglish — batch 4 (student/youth context) ──────────────
        "Pumasa ako sa finals ko at hindi ko mapigilan ang luha sa tuwa.",
        "Naaprubahan ang aking thesis proposal — grabe ang gaan ng pakiramdam.",
        "Nakapagtapos na ako ng isang mahirap na subject at ramdam ko ang kalayaan.",
        "Binigyan ako ng scholarship at parang dream come true talaga.",
        "Nasabi ko na ang aking presentasyon nang maayos at nag-applaude ang klase.",
        "Natuklasan ko ang isang subject na talagang nagpapasaya sa akin.",
        "Naging maayos ang relationship ko sa mga classmates ko ngayon.",
        "Pinuri ng aking guro ang aking trabaho at sobrang nakakatuwa.",
        "Nakapagbayad ako ng tuition ko sa sarili kong pera — proud moment.",
        "Nagtagumpay ako sa isang bagay na matagal ko nang sinisikap.",
        "Natutunan ko ngayon na hindi kailangang perpekto para maging masipag.",
        "Naging malakas ang loob ko ngayon para tanungin ang guro ko.",
        "Nakita ko ang aking pangalan sa honor roll at hindi ko mapaniwalaan.",
        "Nakahanap na ako ng internship at excited na ako magsimula.",
        "Naging maayos ang grupong proyekto namin kahit mahirap ang proseso.",
        # ── Tagalog / Taglish — batch 5 (mental wellness / recovery) ─────────
        "Nagsimula akong mag-therapy at parang nagbubukas ang isang bagong pintuan.",
        "Nag-practice ako ng breathing exercises ngayon at nakatulong talaga.",
        "Mas matagal na akong hindi nag-a-anxiety attack — progress iyon.",
        "Naramdaman ko na kaya ko nang harapin ang mga naging trauma ko.",
        "Nagpapasalamat ako sa aking mental health journey kahit matagal pa.",
        "Natutunan ko na okay lang hindi maging okay — at mas masaya ako ngayon.",
        "Nagsimula akong mag-self-care at naramdaman ko ang pagbabago.",
        "Nag-set ako ng boundary ngayon at hindi ko sinisisi ang sarili ko.",
        "Ramdam ko na dahan-dahang gumagaling na ang puso ko.",
        "Natutunan ko na humingi ng tulong ay tapang at hindi kahinaan.",
        "Naging malinaw ang isip ko ngayon pagkatapos ng matagal na ulap.",
        "Nagpapasalamat ako sa bawat araw na dahan-dahan akong nagiging okay.",
        "Naramdaman ko ang kapayapaan sa loob ko na matagal ko nang hinahanap.",
        "Naging matapang ako ngayon para sabihin kung ano ang totoong nararamdaman ko.",
        "Natutunan ko na ibigin ang sarili ko kahit hindi pa ako perpekto.",
    ],

    "negative": [
        # ── English ───────────────────────────────────────────────────────────
        "I feel sad and lonely today, nothing seems right.",
        "Everything at work is going wrong, I feel so overwhelmed.",
        "I miss my family so much, it hurts being far away.",
        "Another disappointment, I'm starting to lose hope a little.",
        "Feeling tired and unmotivated lately, everything is hard.",
        "I think I failed my exam after studying so much.",
        "Nobody understands how I feel, it's getting exhausting.",
        "Stressed about money and deadlines all week.",
        "Feeling empty, like nothing brings joy anymore.",
        "Regretting my decisions from the past few days.",
        "I have been crying on and off for no clear reason.",
        "My anxiety is making everything harder than it should be.",
        "I feel invisible to the people around me.",
        "The pressure is getting to me and I do not know how to cope.",
        "I snapped at someone I care about today and I feel terrible.",
        "Woke up dreading the day before it even started.",
        "I have been avoiding my responsibilities because I feel stuck.",
        "Nothing I do feels good enough lately.",
        "I feel like I am falling behind everyone else in life.",
        "Lost my motivation completely and cannot seem to find it again.",
        "The loneliness is really getting to me these days.",
        "I keep overthinking everything and it is exhausting my mind.",
        "I feel like a burden to the people closest to me.",
        "My mood has been low for weeks and I am not sure why.",
        "I do not feel like myself anymore and that scares me a little.",
        "I said something wrong and now the tension is unbearable.",
        "I have been isolating myself because I do not have the energy to socialize.",
        "Failed again at something I worked really hard for.",
        "Today felt pointless, like I was just going through the motions.",
        "I am exhausted from pretending everything is fine.",
        "I feel disconnected from people I used to be close to.",
        "My self-confidence has been really low lately.",
        "It is hard to get out of bed when everything feels gray.",
        "I made a mistake and cannot stop beating myself up over it.",
        "Feeling frustrated and stuck with no clear direction.",
        "I am struggling to focus on anything meaningful right now.",
        "Nothing excites me anymore, even things I used to love.",
        "I feel like I am carrying too much weight on my own.",
        "The future feels uncertain and that is weighing on me heavily.",
        "I am trying to hold it together but some days it is just too much.",
        # ── English — batch 2 ─────────────────────────────────────────────────
        "I feel like I am disappearing and no one has noticed.",
        "I have been putting on a brave face but I am exhausted doing it.",
        "I cannot focus on anything today no matter how hard I try.",
        "I feel like I am sleepwalking through my own life.",
        "I got home and just sat in the dark for an hour.",
        "I feel like my emotions are completely out of control lately.",
        "I have been cancelling everything and not leaving the house.",
        "I feel deeply misunderstood by everyone around me.",
        "I keep replaying a conversation and wishing I had said something different.",
        "I feel like crying but I do not even know why.",
        "I have no energy for things I used to love.",
        "I woke up with a pit in my stomach and it never left.",
        "I feel like I am always the one putting in effort in my relationships.",
        "I cannot seem to get out of this low mood no matter what I do.",
        "I missed an important deadline and I feel like a complete failure.",
        "I feel fragile. Like the smallest thing could break me.",
        "I cannot stop thinking about everything that is going wrong.",
        "I have been withdrawn from my friends and I do not know how to explain it.",
        "I feel like no matter what I do it is never enough.",
        "I am so tired of feeling this way and I cannot see it getting better.",
        "I have been sleeping too much to avoid being awake.",
        "I feel like a shell of who I used to be.",
        "I broke down at work today and I am mortified.",
        "My chest has been tight all week and I cannot shake the anxiety.",
        "I feel trapped in a life that does not feel like mine.",
        "I have lost all sense of direction and purpose.",
        "I feel like I am going through the motions but not actually living.",
        "Everything feels difficult even the smallest tasks.",
        "I feel like I am always the last priority to everyone.",
        "I have been eating to cope and I feel guilty about it.",
        "I feel like I am standing still while the world moves forward.",
        "I have been irritable and short with people I care about.",
        "I feel like I cannot catch a break no matter what.",
        "I am so overwhelmed I do not know where to even start.",
        "I feel completely drained after a day that should have been easy.",
        "I have not been taking care of myself and I can feel it.",
        "I feel hollow inside even when things are technically fine.",
        "I am scared of how bad my anxiety has gotten.",
        "I feel like I have nothing to look forward to right now.",
        "I have been avoiding mirrors because I do not like what I see.",
        "I feel like I am failing at everything simultaneously.",
        "I keep waiting for the other shoe to drop.",
        "I feel deeply lonely even when I am surrounded by people.",
        "I got through the day but I felt nothing the entire time.",
        "I feel like the version of myself I am proud of is fading.",
        "I have been putting everyone else first until I had nothing left.",
        "I feel like I am constantly bracing for something bad to happen.",
        "I have lost my sense of humor and I miss it.",
        "I feel like I am failing at being a functional human being.",
        "I have been pretending I am okay for so long I forgot what okay felt like.",
        # ── English — batch 3 ─────────────────────────────────────────────────
        "I argued with someone I love and I cannot stop thinking about it.",
        "I feel like my confidence was something I had once and lost.",
        "I have been surviving on caffeine and avoidance.",
        "I feel like my mental health is slipping and I am scared.",
        "I have been dreading waking up every morning.",
        "I feel unseen in every room I walk into.",
        "I feel like I am carrying grief that nobody else understands.",
        "I have been snapping at people and I hate myself for it.",
        "I feel completely depleted with nothing left to give.",
        "I failed at something publicly and I want to disappear.",
        "I have been numbing out with TV and I know it is not helping.",
        "I feel like I have been sad for so long it has become my personality.",
        "I feel suffocated by my own overthinking.",
        "I made a bad decision and now I am living with the consequences.",
        "I feel invisible in my own family.",
        "I have been skipping class because I cannot face being around people.",
        "I feel like I cannot do anything right.",
        "I have been isolating and telling myself I prefer it.",
        "I feel like I am drowning in responsibilities.",
        "I cannot stop the racing thoughts at night.",
        "I feel like I have been abandoned by the people I trusted most.",
        "I have been crying in the shower so no one hears me.",
        "I feel heavy. Not tired. Just heavy.",
        "I do not remember the last time I felt genuinely happy.",
        "I feel like everyone around me is moving forward and I am stuck.",
        "I have been struggling to eat and when I do eat I feel sick.",
        "I feel like I have let everyone down including myself.",
        "I cannot seem to enjoy anything I used to love.",
        "I feel like I am slowly losing myself.",
        "I have been anxious for so long it has started to feel normal.",
        "I feel out of place everywhere I go.",
        "I have been lying in bed staring at the ceiling every night.",
        "I feel like I am working so hard but going nowhere.",
        "I have been having intrusive thoughts and they scare me.",
        "I feel like my emotions are too big for my body.",
        "I have been isolating and numbing out because feeling things hurts.",
        "I feel like nothing I do matters.",
        "I have been walking around with a knot in my chest all week.",
        "I feel like I used to be capable and I am not sure what happened.",
        "I cannot remember the last time I felt at ease.",
        # ── English — batch 4 (student / academic stress) ─────────────────────
        "I am failing a subject I worked really hard in and I feel so deflated.",
        "I feel like I chose the wrong course and now I am trapped.",
        "I have been comparing myself to classmates who seem to have everything together.",
        "I feel so behind on my thesis I do not know if I can catch up.",
        "I cried after a professor gave me harsh feedback in front of everyone.",
        "I feel like university is crushing me and I cannot say that out loud.",
        "I have been skipping meals to have more time to study but I still feel behind.",
        "I feel like I am not smart enough to be here.",
        "I missed a presentation due to anxiety and I feel like a failure.",
        "I have been so stressed about grades that I cannot sleep.",
        "I feel like I am disappointing my parents every semester.",
        "I cannot find motivation even for subjects I used to love.",
        "I feel like the pressure to succeed is suffocating me.",
        "I failed my qualifying exam and I do not know how to face anyone.",
        "I feel completely burnt out from studying and I still have so much left.",
        "I have been isolating in the library to avoid people but still feel lonely.",
        "I feel like I am not cut out for this.",
        "My OJT is overwhelming and I cannot tell anyone because I should be excited.",
        "I have been having panic attacks before every exam.",
        "I feel like I am only here because of other people's expectations.",
        # ── English — batch 5 (relationship / social distress) ────────────────
        "I feel like my friendship group has moved on without me.",
        "I feel betrayed by someone I thought I could trust completely.",
        "I have been ghosted by someone I cared about and it hurts more than I expected.",
        "I feel like I am the only one in the relationship trying.",
        "I feel deeply hurt by something that was said to me.",
        "I have been feeling resentful and I am ashamed of it.",
        "I feel like I do not belong anywhere.",
        "I have been feeling unloved even though I know people care about me.",
        "I feel like my family does not understand me at all.",
        "I feel so alone even in a room full of people I know.",
        "I have been pushed to the side so many times that I stopped expecting more.",
        "I feel like I am always the one who cares more.",
        "I have been holding a grudge I cannot seem to let go of.",
        "I feel like I am not a priority to anyone.",
        "I feel like the connection I had with someone has quietly disappeared.",
        "I have been feeling taken for granted in every relationship I have.",
        "I feel like nobody really sees me for who I am.",
        "I said something I did not mean and I cannot take it back.",
        "I feel deeply disconnected from the people I used to be closest to.",
        "I have been feeling lonely in a way that feels permanent.",
        # ── English — extended ────────────────────────────────────────────────
        "I feel like I let everyone down again and I cannot shake it.",
        "I have been staring at my phone for hours just to avoid my own thoughts.",
        "I hate feeling like this but I do not know how to change it.",
        "My relationship with my parents has been really tense and draining.",
        "I keep comparing myself to others and it makes me feel terrible.",
        "I was rejected again and it stings more than I expected.",
        "Cried in the bathroom at school so no one would see.",
        "I feel like nobody truly knows me and that is the loneliest feeling.",
        "I snapped at my roommate and I know it was not their fault.",
        "My appetite is gone and I have not been eating properly all week.",
        "I feel numb most of the time and do not know if that is better or worse.",
        "I have been cancelling plans and isolating without meaning to.",
        "Tried to explain how I was feeling but the words would not come out.",
        "I feel guilty for not being grateful when I know others have it worse.",
        "My grades are slipping and I feel out of control.",
        "I am scared of the direction my life is heading but feel too frozen to act.",
        "Every small setback feels enormous right now.",
        "I feel like a failure even though logically I know I am not.",
        "My sleep has been terrible and it is affecting everything.",
        "I want to be productive but even getting up feels like a mountain.",
        "I feel resentful and I am ashamed of feeling that way.",
        "Everything feels like too much and I do not know where to start.",
        "I miss the version of me that was energetic and motivated.",
        "I put on a happy face for everyone but internally I am struggling.",
        "The silence in my apartment feels deafening when I am alone.",
        "I feel like I am treading water and slowly sinking.",
        "I had a full-on panic attack today for the first time in months.",
        "I feel like my best years are behind me and I am only in my twenties.",
        "I am afraid of becoming a burden if I tell people how I really feel.",
        "My chest gets tight whenever I think about the week ahead.",
        "I have been numbing out with screens just to avoid feeling things.",
        "I keep waiting for things to get better but nothing seems to change.",
        "I feel angry at myself for not being stronger.",
        "My friendships feel one-sided lately and it is draining me.",
        "I feel like I am just surviving, not actually living.",
        "I am not okay but I do not even know how to explain it to anyone.",
        "My heart feels heavy today for no single clear reason.",
        "I feel envious of people who seem to have their lives together.",
        "I cried without warning in the middle of a normal day.",
        "I do not feel worthy of the good things that happen to me.",
        # ── Tagalog / Taglish ────────────────────────────────────────────────
        "Malungkot ako ngayon at mag-isa, parang wala nang tama.",
        "Lahat ng ginagawa ko ay mali, sobrang pagod na ako.",
        "Miss na miss ko na ang pamilya ko, masakit ang malayo sa kanila.",
        "Isa na naman itong kabiguan, medyo nawawalan na ako ng pag-asa.",
        "Pagod at walang gana sa lahat ng bagay nitong mga nakaraang araw.",
        "Parang hindi ako pumasa kahit nag-aral naman ako nang mabuti.",
        "Walang nakakaintindi sa nararamdaman ko, nakakapagod na.",
        "Stress na stress ako sa pera at mga gawain ngayong linggo.",
        "Para akong walang nararamdaman, walang nagpapasaya sa akin.",
        "Pinagsisisihan ko ang mga naging desisyon ko nitong nakaraang mga araw.",
        "Umiyak ako nang walang malinaw na dahilan ngayon.",
        "Hindi ko maintindihan kung bakit ganito ang nararamdaman ko.",
        "Parang invisible ako sa mga taong nakapaligid sa akin.",
        "Napakaraming pressure at hindi ko alam kung paano makayanan.",
        "Nagalit ako sa taong mahal ko at sobrang guilty ko ngayon.",
        "Gumising ako na dread na agad ang buong araw bago pa man magsimula.",
        "Iniiwasan ko na ang aking mga responsibilidad kasi nado-down ako.",
        "Hindi na talaga ako makahanap ng dahilan para maging masaya.",
        "Parang lahat ay mas mabilis na umuusad kaysa sa akin.",
        "Nawala na ang aking motibasyon at hindi ko na mahanap pa.",
        "Ang kalungkutan ay talagang nakakaapekto na sa akin ngayon.",
        "Sobrang o-overthink ko ang lahat kaya pagod na ang utak ko.",
        "Pakiramdam ko ay burden ako sa mga mahal ko sa buhay.",
        "Matagal na akong nararamdamang down at hindi ko alam kung bakit.",
        "Hindi ko na alam kung sino na ako at nakakatakot iyon.",
        "Nagkamali ako at hindi ko mapigilan ang mag-isip-isip tungkol doon.",
        "Sarili ko na lang ang nakakasama ko dahil wala na akong lakas para makisama.",
        "Nabigo na naman sa isang bagay na pinaghandaan ko nang maigi.",
        "Walang saysay ang araw ngayon, parang automato lang ang ginagawa ko.",
        "Pagod na ako sa pagpapanggap na okay ang lahat.",
        # ── Tagalog / Taglish — extended ─────────────────────────────────────
        "Pakiramdam ko lagi akong naiwan sa likod ng lahat.",
        "Hirap na hirap akong bumangon ngayon — ayaw lang talaga ng katawan ko.",
        "Tumangis ako sa banyo para hindi makita ng kahit sino.",
        "Parang kahit gaano ko kasikapin, hindi pa rin sapat.",
        "Natatakot ako sa kinabukasan ko at hindi ko alam kung paano harapahin ito.",
        "Napaka-overwhelm ng lahat at hindi ko alam kung saan magsisimula.",
        "Ramdam ko na walang nagtitiwala sa akin kahit dati ay confident naman ako.",
        "Ang hirap ng mag-isa, lalong lalo na ngayong gabi.",
        "Napakaraming problema sa bahay at nadadampi ako nito.",
        "Umalis ang kaibigan ko at parang nawala ang isang malaking bahagi ng sarili ko.",
        "Hindi ko na mawari kung okay pa ba ako o hindi na.",
        "Lagi akong nag-iisip kung ano ang nagawa kong mali para maging ganito ang buhay ko.",
        "Nakaka-drain ang araw ngayon — parang wala akong natanggap kahit saan.",
        "Ayokong makiusap pa ng tulong dahil natatakot akong maging abala.",
        "Parang pilit na ngingiti kahit nasa loob ko ay hinahanap ko pa rin ang dahilan.",
        "Nag-panic attack ako kanina at hindi ko alam kung saan nagmula.",
        "Lagi akong pagod kahit wala namang ginagawa — di ko maintindihan.",
        "Parang lahat ay laban sa akin ngayon at gusto ko na lang umuwi at matulog.",
        "Naiiyak ako sa mga bagay na dati ay hindi ko pinapansin — nagbabago na ba ang isip ko?",
        "Pakiramdam ko nag-iisa ako kahit nasa maraming tao ako.",
        # ── Tagalog / Taglish — batch 2 ───────────────────────────────────────
        "Pakiramdam ko ay palagi akong nag-iisa kahit maraming tao sa paligid ko.",
        "Natatakot na ako sa sarili kong isipan ngayon.",
        "Hindi ko na kaya ang lahat ng pressure na nasa akin ngayon.",
        "Nakakaiyak na kausapin kahit sino kasi walang talagang nakakaintindi.",
        "Napaka-overwhelm ng buhay ngayon at hindi ko alam kung saan magsisimula.",
        "Lagi akong pagod kahit anong gawin ko — parang walang katapusan.",
        "Nawawala na ang aking gana sa mga bagay na dati ay nagpapasaya sa akin.",
        "Parang lahat ng ginagawa ko ay hindi sapat kahit gaano pa ako magsikap.",
        "Hirap na akong bumangon sa umaga — parang laging may mabigat sa dibdib ko.",
        "Napakaraming bagay ang nag-aalala sa akin at hindi ko matigil ang pag-iisip.",
        "Pakiramdam ko ay mas mabilis ang pag-usad ng iba kaysa sa akin.",
        "Namimiss ko ang dating version ko na masaya at puno ng enerhiya.",
        "Nagsasalita ako sa mga tao pero parang hindi naman talaga nila naririnig ako.",
        "Lagi akong pagod kahit matulog pa nang matagal.",
        "Parang palagi akong umaasa na maging okay ang lahat pero hindi nangyayari.",
        "Nag-aaway kami ng mahal ko sa buhay at hindi ko mapayapa ang isip.",
        "Napakaraming responsibilidad at parang nadadaig na ako.",
        "Pakiramdam ko ay burden ako sa pamilya ko.",
        "Wala na akong motibasyon — kahit gaano ko pilitin ang sarili ko.",
        "Hindi ko na kayang itago na okay ako — matagal na akong nahihirapan.",
        "Parang lahat ng kailangan kong gawin ay too much na para sa akin.",
        "Naiiyak ako nang hindi ko alam ang dahilan at nakakagulo ito sa akin.",
        "Naramdaman ko na nawala na ang dati kong pagmamahal sa mga bagay.",
        "Ayoko nang makipag-interact sa kahit sino ngayon — pagod na pagod na ako.",
        "Nagsimulang mawala ang tiwala ko sa sarili ko at nakakatakot ito.",
        "Parang wala nang punto ang pagsisikap ko.",
        "Napaka-frustrated ko sa sarili ko ngayon.",
        "Nag-aalala ako sa kinabukasan ko at hindi ko matigil ito.",
        "Pakiramdam ko na pababa nang pababa ang lahat at hindi ko alam kung paano pigilan.",
        "Nakaramdam ako ng matinding kalungkutan ngayon nang walang malinaw na dahilan.",
        # ── Tagalog / Taglish — batch 3 ───────────────────────────────────────
        "Nagtatago ako sa kwarto ko para makaiwas sa lahat.",
        "Parang natutulog lang ako para hindi na kailangang harapin ang araw.",
        "Kahit kasama ko ang mga kaibigan ko ngayon ay malungkot pa rin ako.",
        "Hindi ko na mahanap ang dahilan para magsikap.",
        "Pakiramdam ko ay paulit-ulit lang ang buhay ko nang walang pagbabago.",
        "Naaapektuhan na ang trabaho ko ng aking emosyon at hindi ko alam ang gagawin.",
        "Nahihirapan ako ngayon pero ayokong mag-abala ng kahit sino.",
        "Napakaraming nag-iisip sa akin kaya hindi na ako makatulog nang maayos.",
        "Pakiramdam ko ay nilalamon na ako ng stress.",
        "Nawa ay maramdaman ko rin ang saya na nararamdaman ng iba.",
        "Lumipas na ang isang linggo pero hindi pa rin ako maka-move on.",
        "Hindi ko alam kung kailan ko ito mararamdamang mas magaan.",
        "Nagsimula akong umiwas sa mga tao kahit mahal ko sila.",
        "Parang bawat araw ay mas mahirap kaysa sa nakaraan.",
        "Pakiramdam ko ay wala nang nagmamalasakit sa tunay na nararamdaman ko.",
        "Umuulit na ang mga masasamang gawi ko at hindi ko mapigilan ang sarili ko.",
        "Naramdaman ko na wala akong kakayahang harapin ang mundong ito ngayon.",
        "Kahit nagre-relax ako ay hindi ko matanggal ang tensyon sa katawan ko.",
        "Pakiramdam ko ay palpak ang lahat ng aking mga desisyon.",
        "Nakakaramdam na ako ng emosyon na hindi ko maintindihan.",
        # ── Tagalog / Taglish — batch 4 (student / academic) ──────────────────
        "Babagsak na siguro ako sa subject na ito at hindi ko alam kung paano sabihin sa magulang ko.",
        "Napaka-overwhelming ng thesis at pakiramdam ko ay hindi ko kayang tapusin.",
        "Naiyak ako pagkatapos ng exam kasi parang wala talaga akong natututo.",
        "Hindi ko ma-focus ang sarili ko sa pag-aaral kahit gaano ko subukan.",
        "Pakiramdam ko ay hindi ako karapat-dapat na mag-aral sa kursong ito.",
        "Stressed na stressed ako sa requirements at hindi ko pa natapos ang isa.",
        "Naawa ako sa sarili ko habang pinagmamasdan ko ang mga naka-honor roll.",
        "Nakaramdam ako ng matinding pagkatalo pagkatapos ng nasabing mataas kong grade na hindi ko natanggap.",
        "Hindi na ako makapag-concentrate sa kahit anong aralin.",
        "Pakiramdam ko ay nakulangan ako sa lahat ng bagay sa eskwela ngayon.",
        "Natatakot akong bumalik sa klase pagkatapos ng matagal na absent.",
        "Nagsimula akong mag-doubt sa sarili ko dahil palagi akong nahaharap sa pagkabigo.",
        "Hindi na ako excited sa anumang subject — parang puro obligasyon na lang.",
        "Pakiramdam ko ay pinagtatawanan ako ng mga classmate ko.",
        "Hindi ko kayang i-cope sa presyon ng pag-aaral at trabaho sa iisang oras.",
        # ── Tagalog / Taglish — batch 5 (relationships / isolation) ──────────
        "Pakiramdam ko ay pinalayo na ako ng mga kaibigan ko nang walang dahilan.",
        "Nag-iisip ako kung bakit palagi akong nag-iisa kahit may mga tao sa paligid ko.",
        "Nasaktan ako ng taong pinakamahal ko at hindi ko alam kung paano mag-move on.",
        "Pakiramdam ko ay hindi ako minamahal ng tunay ng mga taong nasa paligid ko.",
        "Lumayo na sa akin ang mga kaibigan ko at hindi ko alam kung bakit.",
        "Parang palagi akong iniiiwan ng mga taong pinagtitiwalaang mabuti.",
        "Hindi ko maramdaman ang koneksyon sa pamilya ko kahit lagi kaming magkasama.",
        "Pakiramdam ko ay wala akong tunay na kaibigan na makausap nang totohanin.",
        "Nag-aaway kami ng magulang ko at parang bumabagsak ang mundo ko.",
        "Nakakaramdam ako ng isolation kahit aktibo pa rin ako sa labas.",
        "Nasaktan ang aking pagpapahalaga sa sarili dahil sa sinabi ng isang tao sa akin.",
        "Nararamdaman ko na paulit-ulit lang ang parehong problema sa relasyon ko.",
        "Pakiramdam ko ay hindi ako karapat-dapat sa pagmamahal ng kahit sino.",
        "Hindi ko na matandaan kung kailan pa ako huling naramdamang tunay na minamahal.",
        "Parang lagi akong nagmamahal nang mas malalim kaysa sa mga nagmamahal sa akin.",
    ],

    "distress": [
        # ── English ───────────────────────────────────────────────────────────
        "I don't want to live anymore, nothing matters to me now.",
        "I've been thinking about hurting myself all week.",
        "Nobody can save me from this pain, I'm losing my mind.",
        "Everything is hopeless, I want to end it all right now.",
        "I wrote a goodbye letter today, I can't handle this anymore.",
        "The pain is unbearable, I'm scared of what I might do.",
        "No one cares if I disappear anyway, what's the point of living.",
        "I keep seeing no way out of this suffering.",
        "If tomorrow comes I don't know if I can keep going anymore.",
        "I've hidden pills because I want to stop feeling everything.",
        "I have been making plans to end my life because I cannot take this anymore.",
        "Every morning I wake up wishing I had not.",
        "I feel completely worthless and like the world would be better without me.",
        "I am so tired of fighting just to survive every single day.",
        "I told someone I was fine but inside I want to disappear forever.",
        "I have been researching methods because I am serious about ending this.",
        "I cut myself last night just to feel something other than numbness.",
        "There is no reason for me to continue existing.",
        "I gave away some of my things because I am not planning to need them.",
        "I have not slept in days because I am terrified of my own thoughts.",
        "I feel like a complete failure and see no future for myself.",
        "I keep thinking that everyone I love would be better off if I was gone.",
        "I stopped eating because I do not think I deserve to take care of myself.",
        "I am at the edge and one more thing might push me over.",
        "I cannot breathe through this pain anymore, I want it to stop permanently.",
        "I texted my best friend goodbye but they did not take me seriously.",
        "I am not looking for comfort. I have already decided.",
        "Every day I think about jumping. I just have not done it yet.",
        "I have a plan and I know exactly what I will do.",
        "I am saying goodbye in this journal because no one else will listen.",
        "I feel so trapped that death feels like the only exit.",
        "I have been hurting myself every week and hiding the scars.",
        "Nobody would notice if I stopped showing up tomorrow.",
        "I have lost the will to fight this battle anymore.",
        "I am reaching out because I am scared of what I am capable of tonight.",
        "I think about crashing my car on purpose when I am driving.",
        "I wrote down who gets my stuff if something happens to me.",
        "There is no version of the future where things get better for me.",
        "My last hope is gone and I have nothing left to hold on to.",
        "Napagod na ako sa paggising araw-araw para lang maramdaman ito.",
        # ── English — batch 2 ─────────────────────────────────────────────────
        "I have been writing farewell letters in my head every night.",
        "I do not want to be dramatic but I genuinely cannot see a future for myself.",
        "The only thing stopping me is not knowing if it will actually work.",
        "I have started saying goodbye to people without them knowing.",
        "I feel nothing. Not sad, not angry. Just completely empty and done.",
        "I have been researching painless ways because I cannot take more pain.",
        "I am not okay and I am past the point of pretending I might be.",
        "I have been self-harming for months and nobody has noticed.",
        "I feel like the kindest thing I could do for everyone is disappear.",
        "I am scared of being alone tonight because of what I might do.",
        "I have been standing at the edge of things and wondering.",
        "I have given away my most important possessions this week.",
        "I do not feel suicidal in a loud way. It is quiet and constant.",
        "I have been mixing substances to feel something or to feel nothing.",
        "I have stopped making plans because I do not expect to need them.",
        "I feel like I have been dying slowly for years and now I am ready.",
        "I have written the note. I just have not decided on the date.",
        "I keep driving past places and thinking about it.",
        "I am terrified of my own mind right now.",
        "I told one person and they told me I was being dramatic. Now I tell no one.",
        "I feel like a burden that everyone would be relieved to put down.",
        "I have been hurting myself in secret because it is the only thing that feels real.",
        "I do not see another ten years. I cannot even picture another year.",
        "I have been saying goodbye in little ways that nobody notices.",
        "I feel completely hollow. Whatever was keeping me going is gone.",
        "I made my decision last night. I feel calmer than I have in months.",
        "I have been stockpiling things over the last few weeks.",
        "I have not eaten in days because I stopped caring about keeping myself alive.",
        "I feel beyond saving at this point.",
        "I have been fantasizing about it and the fantasy brings me relief.",
        "I am reaching out here because I have nowhere else to go tonight.",
        "I do not need someone to talk me out of it. I need someone to understand why.",
        "I have been cutting myself every time the thoughts get too loud.",
        "I feel like I am standing at the edge of a cliff and leaning forward.",
        "I wrote down the name of everyone who should be notified.",
        "I feel ready. That is the word — ready.",
        "I have been planning it for weeks. Tonight feels like the night.",
        "I am not asking for help. I am documenting.",
        "I called the hotline twice and hung up. I do not think I deserve help.",
        "I feel like death is the only door left that is not locked.",
        # ── English — batch 3 ─────────────────────────────────────────────────
        "I have been thinking about ending my life every day for the past month.",
        "I told my cat goodbye this morning.",
        "I have been sitting with a bottle of pills trying to decide.",
        "I feel like I am already gone. This is just the remaining paperwork.",
        "I have been looking for signs to stop. I have not found any.",
        "The thought of not waking up tomorrow is the only thing bringing me comfort.",
        "I feel like I am a problem that only has one solution.",
        "I have been locking sharp objects away to protect myself from myself.",
        "I told a stranger online tonight because I could not tell anyone who knows me.",
        "I have been writing a list of reasons to stay and it keeps getting shorter.",
        "I feel like I am clinging to a ledge and my fingers are slipping.",
        "I have made peace with it. That is what worries me most about myself.",
        "I stopped returning texts because it felt like lying about still being here.",
        "I have been spending time alone finishing things and saying silent goodbyes.",
        "I feel like my mind has already checked out. My body just has not caught up.",
        "I have been keeping a knife close and I do not fully trust myself with it.",
        "I feel like I have been waiting to die for so long it became a plan.",
        "I have been isolating so that nobody will notice when I am gone.",
        "I do not want sympathy. I just needed to say it somewhere.",
        "I have been preparing quietly so no one has to deal with a mess.",
        "I feel trapped inside my own head with no emergency exit.",
        "I have been leaving voicemails I record but never send.",
        "I called a crisis line and told them I was fine because I did not want to be stopped.",
        "I feel like I have been grieving my own life for months.",
        "I do not feel sad anymore. I feel decided.",
        "I have been hurting myself just to prove I can still feel something.",
        "I feel like I am already a ghost just waiting for the rest to catch up.",
        "I stopped caring about consequences a long time ago.",
        "I have been fantasizing about it in detail and it feels like the only relief.",
        "I have been falling apart privately and smiling publicly.",
        "I have been standing on bridges for too long on my way home.",
        "I feel like everyone would grieve for a week and then move on.",
        "I have been collecting things and I know what that means.",
        "I cannot remember the last time I wanted to wake up.",
        "I keep thinking about what my absence would feel like versus what my presence feels like.",
        "I feel like the world is a place I was never meant to belong in.",
        "I have been trying to hold on but my grip is getting weaker.",
        "I feel like I have been saying goodbye for months without using the word.",
        "I have been documenting things in this journal in case someone needs to understand later.",
        "I feel like I have nothing left to lose.",
        # ── English — batch 4 (minimized / masked distress) ───────────────────
        "I keep telling myself it is just a phase but it has been a year.",
        "I smile every day at work and go home and think about not coming back.",
        "People tell me I seem fine and maybe that is the most dangerous thing.",
        "I do not think this counts as a crisis but I have been planning something.",
        "I told my therapist I was stable because I did not want to be hospitalized.",
        "I keep dismissing my own thoughts as dramatic but they are getting louder.",
        "I feel like I should be okay but something in me has already given up.",
        "I laugh and joke and nobody knows I have been thinking about ending it.",
        "I am not sure if what I feel counts as suicidal but it scares me.",
        "I keep telling myself I would never actually do it but I think about it daily.",
        "I have not told a single person because I do not want to be a burden.",
        "I minimize what I feel to everyone and I think that is making it worse.",
        "I do not think I am in crisis but I fantasize about not existing.",
        "I have been saying I am tired when the truth is I want to stop.",
        "I am not sure if this is just a dark patch or something more serious.",
        "I keep rationalizing the thoughts away but they keep returning.",
        "I feel fine during the day and then the night comes and I scare myself.",
        "I did not think I needed help until I caught myself making plans.",
        "I keep saying I would never but my mind keeps rehearsing it.",
        "I am not going to do anything but I cannot stop thinking about it either.",
        # ── English — batch 5 (young adult / student context) ─────────────────
        "I failed out of my program and I do not see a reason to continue living.",
        "My parents sacrificed everything for me and I have nothing to show for it.",
        "I cannot face another rejection letter. I am done trying.",
        "I feel like I have disappointed everyone who ever believed in me.",
        "I came to this city alone and I have never felt more like I do not belong.",
        "I have been failing quietly for months and I do not know how much longer I can hide it.",
        "I feel like the pressure to succeed has broken something in me.",
        "I cannot see a version of the future where I am okay.",
        "I have been thinking that dropping out and disappearing would be easier than explaining.",
        "I feel like I am not built for this world and I am tired of pretending otherwise.",
        "I failed again and I genuinely do not have the energy to try one more time.",
        "I feel like I came here with dreams and they have all been taken from me.",
        "I cannot go home because I have nothing good to tell them.",
        "I feel like I was never going to make it and now I have the proof.",
        "I have been thinking about the bridge near campus every time I walk past it.",
        "I feel completely and utterly defeated.",
        "I have been alone in my dorm for two weeks without leaving.",
        "I feel like I am fighting a battle I was never going to win.",
        "I stopped submitting requirements because I stopped caring about finishing.",
        "I feel like a disappointment in every possible direction.",
        # ── English — extended ────────────────────────────────────────────────
        "I do not want to die but I want this pain to stop and I see no other way.",
        "I have been standing at the edge of the bridge and just staring down.",
        "I need someone to help me but I do not know how to ask without scaring people.",
        "I feel like a ghost. I walk around and no one really sees me.",
        "I have been hurting myself and every time I tell myself it will be the last.",
        "I feel beyond repair. Like I am broken in a way that cannot be fixed.",
        "I wrote a list of everyone who would be affected if I were gone — it was short.",
        "The only reason I am still here is because I am afraid of the pain, not because I want to stay.",
        "I have been taking more than the recommended dose because I want it to stop.",
        "I have already said my goodbyes in my head.",
        "I told my dog goodbye this morning. That felt real.",
        "I do not think I will be here by the end of the week.",
        "I have not showered in a week or eaten properly — I feel like I am giving up.",
        "I keep looking up methods and I am scared of myself.",
        "I am writing this because I think it might be my last entry.",
        "I feel like a burden and the kindest thing I can do is remove myself.",
        "The intrusive thoughts are getting louder and harder to ignore.",
        "I have been drinking alone every night and the thoughts get darker.",
        "I do not see the point of any of this anymore. Not work, not relationships, nothing.",
        "I feel like I am watching my life from outside my body and waiting for it to end.",
        "I am scared to be alone tonight because of the thoughts I have been having.",
        "I stopped going to class and I do not think I am coming back.",
        "I have never felt this level of emptiness. It is beyond sadness.",
        "The silence in my head has been replaced with one thought: I want out.",
        "I keep putting sharp objects away from where I sleep to keep myself safe.",
        "I feel like I am clinging to a rope and my hands are almost out of strength.",
        "I no longer feel pain when I hurt myself and that terrifies me.",
        "I called the hotline but hung up because I thought they would judge me.",
        "I am documenting everything in this journal in case someone needs to understand later.",
        "I am not dramatic. I am genuinely scared of what I will do tonight.",
        "I feel like the world has been sending me signals that it is time to leave.",
        "I feel unsaveable. Like whatever help exists is not meant for someone like me.",
        "I do not feel suicidal in a dramatic way. It is quiet and it has become my constant.",
        "I have made peace with it. That is what scares me most.",
        "Praying that I do not wake up is the only prayer I have left.",
        "I am keeping a knife under my mattress and I do not know why.",
        "The last time I felt truly happy was so long ago I cannot remember it.",
        "I am alive out of inertia, not because I want to be.",
        "I have been researching how much of this medication it would take.",
        "I feel like I have already checked out. I am just waiting for the physical part to catch up.",
        # ── Tagalog / Taglish ────────────────────────────────────────────────
        "Ayaw ko nang mabuhay, wala nang saysay ang lahat para sa akin.",
        "Buong linggo ko nang iniisip na saktan ang sarili ko.",
        "Walang makapagliligtas sa akin sa sakit na ito, nababaliw na ako.",
        "Wala nang pag-asa ang lahat, gusto ko nang tapusin ang lahat ngayon din.",
        "Nagsulat na ako ng goodbye letter ngayong araw, hindi ko na kaya.",
        "Hindi na matiis ang sakit, natatakot na ako sa pwede kong gawin.",
        "Walang magmamalasakit kung mawawala man ako, para saan pa ang mabuhay.",
        "Wala na akong makitang paraan para makaalis sa paghihirap na ito.",
        "Kung darating ang bukas, hindi ko na alam kung kaya ko pa bang magpatuloy.",
        "Nagtago ako ng mga gamot dahil gusto ko nang itigil ang lahat ng nararamdaman ko.",
        "Gumigising ako araw-araw na sana hindi na ako nagising pa.",
        "Pakiramdam ko walang silbi ang aking buhay at mas magiging mabuti ang lahat kung wala ako.",
        "Napagod na ako sa pakikipaglaban sa bawat araw para mabuhay.",
        "Sinabihan ko siya na okay ako pero sa loob ko, gusto ko nang mawala.",
        "Pinag-aralan ko na kung paano ito gagawin kasi seryoso na ako.",
        "Nagpapugto-pugto na ako at tinatago ko ang mga sugat.",
        "Wala nang dahilan para magpatuloy ang aking pag-iral.",
        "Ibinigay ko na ang ilan sa aking mga gamit kasi hindi ko na kailangan.",
        "Hindi na ako makatulog nang maayos sa takot sa sarili kong isipan.",
        "Lubos na akong nabigo at wala na akong nakikitang kinabukasan para sa akin.",
        "Palagi kong iniisip na mas magiging masaya ang lahat kung wala ako.",
        "Tinanggihan ko nang kumain dahil hindi ko nararamdamang karapat-dapat akong alagaan ang sarili.",
        "Nasa gilid na ako at isa pang bagay ang maaring magtulak sa akin.",
        "Hindi ko na kaya ang sakit na ito, gusto ko na itong tumigil — permanente.",
        "Nagtext na ako ng paalam sa kaibigan ko pero hindi siya naniniwala.",
        "Hindi na ako naghahanap ng aliw. Napagdesisyunan ko na.",
        "Iniisip ko kung paano mag-crash ng sasakyan habang nagmamaneho.",
        "Isinulat ko na kung sino ang makakakuha ng gamit ko kung may mangyari.",
        "Wala nang bersyon ng kinabukasan na magiging mabuti para sa akin.",
        "Napagod na ako sa paggising araw-araw para lang maramdaman ito.",
        # ── Tagalog / Taglish — extended ─────────────────────────────────────
        "Nagpaalam na ako sa mga taong mahal ko sa puso ko kahit hindi nila alam.",
        "Palagi kong tinitingnan ang tuktok ng gusali at nag-iisip.",
        "Natatakot na ako sa sarili ko ngayong gabi.",
        "Sinabi ko na nga sa kanila na okay ako pero sa totoo lang naghahanap na ako ng paraan.",
        "Nag-research na ako kung magkano ang kailangan para maging epektibo.",
        "Hindi ko alam kung kailan pero plano ko na ito at hindi na ako takot.",
        "Naramdaman ko na wala nang punto ang patuloy pang subukan.",
        "Lihim akong umiiyak tuwing gabi at nagpe-pray na huwag na akong magising.",
        "Sinabi ko sa nanay ko na mahal ko siya nang hindi niya alam na paalam na iyon.",
        "Dati lang mahirap ang buhay, ngayon parang imposible na.",
        "Kumatok na ang mga masasamang isipan at hindi ko na maipagtanggol ang sarili ko.",
        "Ang sakit ng nararamdaman ko ay hindi na mabata ng salita.",
        "Pakiramdam ko wala nang dapat pang gawin — tapos na ang lahat para sa akin.",
        "Nagsimula akong ipagsama-sama ang mga gamit ko — hindi para maglipat, kundi para lisanin na.",
        "Tahimik na lang ako ngayon at hindi na ako nagrereklamo — nag-accept na ako.",
        "Nagtatago na ako ng blades sa ilalim ng kama ko.",
        "Umiyak ako nang walang tigil nang mag-isa, at pagkatapos ay nagtanong ako sa sarili ko kung bakit pa.",
        "Nakakaramdam ako ng walang ingay sa loob ng utak ko ngayon — at mas nakakatakot iyon kaysa sa ingay.",
        "Hindi ko na alam kung para kanino pa ako nagtitiis.",
        "Ibig sabihin na ng lahat ng ito ay tapos na. Okay na ako doon.",
        # ── Tagalog / Taglish — batch 2 ───────────────────────────────────────
        "Parang hindi ko na kayang lumaban pa — gusto ko na lang tigilan ang lahat.",
        "Lagi akong nagiisip ng paraan para mawala nang permanente.",
        "Nagsulat na ako ng mensahe para sa mga mahal ko sa buhay.",
        "Natatakot na ako sa sarili ko ngayong gabi — hindi ko alam kung kaya ko.",
        "Naghahanap na ako ng paraan at nagpaplano na sa detalye.",
        "Wala na akong pakialam kung ano ang mangyayari sa akin.",
        "Naramdaman ko na ang kapayapaan sa ideya ng hindi na muling gising.",
        "Tinanong ko ang sarili ko kung para kanino pa ako nagtitiis — wala akong naisip.",
        "Hindi ko na pinipigilan ang mga isipang ito — nagpapahinga na lang ako sa kanila.",
        "Lihim ko itong ginagawa sa loob ng maraming buwan at wala pang nakakaalam.",
        "Nagsimula na akong mag-alis ng mga gamit ko para hindi magulo pagkatapos.",
        "Pinagdadaanan ko ito nang mag-isa at hindi ko na kaya.",
        "Sinabi ko sa lahat na okay ako pero sa gabi ay naghahanap na ako ng paraan.",
        "Naramdaman ko na handa na ako at hindi na iyon nakakatakot sa akin.",
        "Walang makakatulong sa akin — nasubukan ko na ang lahat.",
        "Hindi ko na makita ang anumang punto sa pagpapatuloy.",
        "Nagsimula na akong sumabak sa mga bagay na dati ay takot na takot ako — dahil wala na akong dapat ipaglaban.",
        "Nag-iisip na ako nang detalyado kung paano at kailan.",
        "Nawala na ang lahat ng dahilan ko para mabuhay.",
        "Hinihintay ko na lang ang tamang pagkakataon.",
        "Inilaan ko na ang mga bagay ko sa mga taong mahal ko — wala na akong kailangan.",
        "Pakiramdam ko ay matagal ko na itong nililim sa loob ko at ngayon ay puno na.",
        "Hindi ko na matakasan ang isipang ito kahit gaano ko subukan.",
        "Nai-text ko na ang aking huling mensahe sa kaibigan ko.",
        "Naihanda ko na ang lahat — hinihintay ko na lang ang gabi.",
        "Nagpaplano na ako nang masinsinan at hindi ko na ito mapigilan.",
        "Ang pinakamalapit na tulay sa amin ay lagi na akong naghihintay doon.",
        "Pakiramdam ko ay tapos na ang aking kwento at ito na ang huling pahina.",
        "Natutuwa na ako sa ideya ng katahimikan — permanenteng katahimikan.",
        "Nagsimula na akong mag-goodbye nang hindi nila nalalaman.",
        # ── Tagalog / Taglish — batch 3 ───────────────────────────────────────
        "Pinag-aralan ko nang mabuti ang mga paraan at may napili na ako.",
        "Wala nang makakapigil sa akin ngayong gabi.",
        "Sinabi ko sa nanay ko na mahal ko siya — hindi niya alam na paalam na iyon.",
        "Naglalakad ako sa tabi ng overpass at lagi akong humihinto.",
        "Hindi ko na iniisip kung masakit o hindi — basta matapos na.",
        "Nag-research ako nang malalim at alam ko na ang gagawin ko.",
        "Pakiramdam ko ay ang tanging paraan para tumigil ang sakit ay ang tumigil na rin ako.",
        "Nagsusulat ako ngayon dahil baka ito na ang huli.",
        "Handa na ako — hindi ito drama, ito ay desisyon.",
        "Ang katahimikan ng isip ko ngayon ay nakakatakot dahil dati puno ito ng ingay.",
        "Gusto kong maging malaya mula sa lahat ng ito at isa lang ang paraan na alam ko.",
        "Nagsimula akong magtago ng mga bagay na maaring gamiting pananakit sa sarili.",
        "Hindi ko na inaasahan na mabuhay pa hanggang susunod na taon.",
        "Naramdaman ko na handa na akong iwan ang lahat.",
        "Pinili ko na kung sino ang makakakuha ng aking mga ari-arian.",
        "Uminom ako ng mas marami kaysa sa dosis para makita kung anong mangyayari.",
        "Wala nang ibang gusto ang puso ko kundi tumigil na.",
        "Nawala na ang aking pag-asa at kasabay nito ang aking kagustuhang mabuhay.",
        "Hindi na ako natatakot sa posibilidad na hindi na ako gising bukas.",
        "Pinili ko ang petsa at naghahanda na ako.",
        # ── Tagalog / Taglish — batch 4 (masked / minimized) ─────────────────
        "Baka dramatic lang talaga ako pero ang mga iniisip ko ay nakakatakot.",
        "Hindi ko sinasabi sa kahit sino kasi baka isipin nilang attention-seeking.",
        "Nag-iisip ako ng bagay na hindi ko gustong aminin kahit sa sarili ko.",
        "Sinasabi ko na okay lang pero sa gabi ay iba ang iniisip ko.",
        "Hindi ko alam kung ito ba ay isang crisis o iniisip ko lang nang labis.",
        "Tinatanggal ko ang mga isipang ito sa isipan ko pero bumabalik pa rin sila.",
        "Baka masyado lang akong maramdamin pero takot na ako sa sarili kong mga plano.",
        "Ngumingiti ako sa lahat tapos uuwi na may iniisip na.",
        "Hindi ko gustong mag-alala ang sinuman kaya nagtatago ako ng totoo.",
        "Sinabi ko sa therapist ko na okay na ako — pero hindi totoo iyon.",
        "Parang normal na sa akin ang mag-isip nito araw-araw — at iyon ang nakakatakot.",
        "Hindi ko sasabihin sa pamilya ko kasi ayokong magparamdam ng burden.",
        "Pinipigilan ko pa rin ang sarili ko pero hindi ko alam hanggang kailan.",
        "Tinatanong ko ang sarili ko kung gusto ko pa talagang malaman ang sagot.",
        "Hindi dramatic — seryoso na ako at natatakot ako sa sarili ko.",
        # ── Tagalog / Taglish — batch 5 (student / youth context) ────────────
        "Nabigo na ako sa lahat at hindi ko na makita ang punto ng pagpapatuloy.",
        "Pinagsacripyo ng magulang ko lahat para sa pag-aaral ko at nabigo lang naman ako.",
        "Nag-aaral akong mag-isa nang malayo sa pamilya at pakiramdam ko ay namamatay na ako dito.",
        "Wala na akong ibang makita na solusyon — ayaw ko nang subukan.",
        "Nadismaya na ako nang husto sa sarili ko at sa buhay ko.",
        "Pakiramdam ko ay hindi ako karapat-dapat na ipagpatuloy ang pag-aaral o kahit ang buhay.",
        "Nagsimula akong mag-isip ng hindi maganda habang naglalakad pauwi mula sa iskwelahan.",
        "Hindi ko na kayang harapin ang susunod na araw sa paaralan.",
        "Lagi kong naiisip ang tulay sa daan pauwi.",
        "Parang nawala na ang lahat ng rason para magsikap pa — at kasama na riyan ang rason para mabuhay.",
        "Hindi ko na gustong bumalik pa sa paaralan o kahit saan.",
        "Napakaraming bigo at hindi ko na kayang tiisin pa ang isa pa.",
        "Pakiramdam ko ay nabigyan ako ng buhay na hindi ko naman hiniling at gusto ko nang ibalik.",
        "Wala na akong lakas para harapin ang bukas — ni isa.",
        "Napakaraming inaasahan sa akin at hindi ko na kaya — gusto ko nang mawala.",
    ],
}

# ── Ambiguous / mixed-emotion samples (harder classification cases) ──────────
# These are realistic journal entries that contain mixed signals.
# They push the model to learn nuanced boundaries between classes.
SYNTH_AMBIGUOUS = {
    "positive": [
        # Recovering / bittersweet but ultimately positive
        "It was a tough week but I made it through. Feeling relieved and proud.",
        "I cried a lot today but also laughed with my best friend. Life is strange.",
        "Things are still uncertain but I chose to focus on what I am grateful for.",
        "I am not fully okay yet but I feel progress and that matters.",
        "Struggled with negative thoughts but managed to redirect them. Small win.",
        "After a hard month, today finally felt like things might be turning around.",
        "Masakit pa rin pero lumaban ako ngayon at proud ako sa sarili ko.",
        "Hindi pa okay ang lahat pero may saysay pa rin ang buhay.",
        # Extended
        "I was anxious all morning but the afternoon brought something lighter.",
        "I have been struggling lately but today I genuinely felt a spark of hope.",
        "It is not perfect but there is beauty in where I am right now.",
        "I broke down and then put myself back together. I am still here.",
        "Nag-breakdown ako kanina pero pagkatapos noon ay okay na ako.",
        "Masakit ang nakaraan pero puno pa rin ng pag-asa ang kinabukasan ko.",
        "Nagpahinga ako at naramdaman ko na okay pa ang lahat.",
        "Nakita ko ang kagandahan ng buhay kahit sa gitna ng kahirapan.",
    ],
    "negative": [
        # Clearly struggling but no suicidal/self-harm content
        "I told myself I was fine but honestly I have been falling apart quietly.",
        "I smiled at work but came home and just stared at the ceiling for hours.",
        "I keep functioning but inside I feel completely hollow and disconnected.",
        "My grades are slipping and I feel like no matter what I try, it is not enough.",
        "I do not want to die but I also do not want to feel like this anymore.",
        "Some days I just do not see the point but I keep going anyway.",
        "Okay lang sabi ko sa lahat pero sa totoo lang, nanghihina na ako.",
        "Lumalaban pa rin ako pero pagod na pagod na talaga ang puso ko.",
        # Extended
        "I feel hollow but I am not in danger — I just cannot shake this emptiness.",
        "Sometimes I wish I could disappear for a while, not forever, just to rest.",
        "I am not suicidal. I just want to stop feeling this heavy all the time.",
        "There are moments I wonder what the point is — but I know I still want to try.",
        "I do not want to end my life but I genuinely do not know how to make it better.",
        "Hindi ko nais masaktan ang sarili ko pero ayoko na rin ng ganito.",
        "Gusto ko lang na mawala sandali ang lahat ng to — hindi permanente.",
        "Pagod na ako pero hindi naman ako sumusuko — naghahanap lang ako ng pahinga.",
    ],
    "distress": [
        # Distress signals mixed with denial or minimizing language
        "I keep telling myself it is fine but I have been thinking about not waking up.",
        "I do not want to worry anyone so I smile, but I have a plan and I am scared of myself.",
        "Maybe I am overreacting but I have been stockpiling pills just in case.",
        "I know it sounds dramatic but I genuinely do not see a reason to keep going.",
        "I am not sure if what I am feeling is normal or if I need help urgently.",
        "I do not want to die but I want the pain to stop and I cannot think of another way.",
        "Sinasabi ko sa sarili ko na okay lang pero lagi ko nang iniisip na mawala.",
        "Baka dramatic lang ako pero seryoso na rin ang aking mga iniisip tungkol sa pag-alis.",
        # Extended
        "People keep saying it gets better but I have been waiting for years and it has not.",
        "I laugh during the day and at night I have the darkest thoughts — nobody knows.",
        "I am not sure if this counts as a crisis but I have been planning something.",
        "I told my therapist I was fine because I did not want to be hospitalized.",
        "I keep telling myself tomorrow will be different but then I think — why bother.",
        "Ayaw ko nang gumising bukas — hindi dramatic, seryoso talaga.",
        "Sinasabi ko okay lang pero sa gabi ay nag-iisip na ako ng mga bagay na hindi ko gustong sabihin.",
        "Baka crazy lang ako pero ang mga iniisip ko ngayon ay hindi normal.",
    ],
}


def generate_synthetic(n_per_class: int = 200) -> pd.DataFrame:
    """Generate a realistic synthetic Taglish dataset for demos/testing.

    Combines the main SYNTH pool with SYNTH_AMBIGUOUS to ensure the model
    sees mixed-emotion and boundary-case entries during training.
    """
    rows = []
    for label, texts in SYNTH.items():
        # Merge ambiguous samples into the main pool for this label
        ambiguous = SYNTH_AMBIGUOUS.get(label, [])
        full_pool = texts + ambiguous
        rng = np.random.RandomState(RANDOM_SEED + LABEL2IDX[label])
        pool = full_pool * max(1, (n_per_class // len(full_pool) + 1))
        rng.shuffle(pool)
        for t in pool[:n_per_class]:
            # Inject a little realistic text noise
            final = t
            if rng.random() < 0.15:
                final += " " + rng.choice(
                    [
                        "",
                        "sana okay na",
                        "hayst buhay",
                        "anyway",
                        "thanks for listening",
                        "salmat sa pakikinig",
                        "hindi ko alam",
                        "just needed to write this down",
                        "ewan ko ba",
                        "whatever happens",
                    ]
                )
            rows.append(
                {
                    "text": final.strip(),
                    "label": label,
                    "source": "synthetic_taglish",
                    "language": detect_lang_taglish(final),
                }
            )
    df = pd.DataFrame(rows).sample(frac=1.0, random_state=RANDOM_SEED).reset_index(drop=True)
    return df


# ------------------------------
# MAIN PIPELINE
# ------------------------------
def load_source_dataset(args) -> pd.DataFrame:
    """Load from CSV/JSONL OR use synthetic dataset."""
    if args.input and Path(args.input).exists():
        p = Path(args.input)
        print(f"[DATA] Loading dataset from {p}")
        if p.suffix.lower() in (".csv",):
            df = pd.read_csv(p)
        elif p.suffix.lower() in (".jsonl", ".json"):
            df = pd.read_json(p, lines=(p.suffix.lower() == ".jsonl"))
        else:
            raise ValueError(f"Unsupported input file: {p.suffix}")
        # Expect columns: text / content / sentence + label / sentiment
        col_aliases_text = ["text", "content", "sentence", "message"]
        col_aliases_label = ["label", "sentiment", "target", "class"]

        def find_col(aliases):
            for a in aliases:
                if a in df.columns:
                    return a
            return None

        tcol = find_col(col_aliases_text)
        lcol = find_col(col_aliases_label)
        if tcol is None or lcol is None:
            raise ValueError(
                f"Input dataset must have a text column ({col_aliases_text}) "
                f"and a label column ({col_aliases_label}). Got: {list(df.columns)}"
            )
        df = df.rename(columns={tcol: "text", lcol: "label"})
        df = df[["text", "label"]].copy()
        df["source"] = f"user_{p.stem}"
        return df

    print(f"[DATA] No input provided — generating SYNTHETIC demo dataset "
          f"({args.synthetic_per_class} per class)...")
    return generate_synthetic(n_per_class=args.synthetic_per_class)


def balance_dataset(df: pd.DataFrame, strategy: str = "weights") -> tuple[pd.DataFrame, dict]:
    """Balance dataset. strategy = 'weights' (class weights) or 'upsample' (random upsampling)."""
    counts = df["label"].value_counts().to_dict()
    print(f"\n[BALANCE] Before: {counts}")

    if strategy == "weights":
        total = sum(counts.values())
        weights = {lab: total / (len(LABELS) * cnt) for lab, cnt in counts.items()}
        return df, {"class_weight": weights}

    if strategy == "upsample":
        max_count = max(counts.values())
        frames = []
        for lab in LABELS:
            sub = df[df["label"] == lab]
            if len(sub) == 0:
                continue
            frames.append(
                sub.sample(max_count, replace=True, random_state=RANDOM_SEED)
            )
        out = pd.concat(frames).sample(frac=1.0, random_state=RANDOM_SEED).reset_index(drop=True)
        print(f"[BALANCE] After upsampling: {out['label'].value_counts().to_dict()}")
        return out, {"class_weight": "balanced_upsampled"}

    raise ValueError(f"Unknown strategy: {strategy}")


def split_dataset(df: pd.DataFrame, train_frac=0.75, val_frac=0.125):
    """Stratified train/val/test split.

    Stratifies on label+language when all strata have >= 2 members in each
    split; falls back to label-only stratification when any stratum is too
    small (e.g. 'mixed' language category with very few samples).
    """
    from sklearn.model_selection import train_test_split

    def _safe_split(data, test_size, strat_col):
        """Try stratified split; fall back to label-only if a stratum is too small."""
        min_count = data[strat_col].value_counts().min()
        # Need at least 2 per stratum so that each split gets >= 1
        if min_count >= 2:
            try:
                return train_test_split(
                    data, test_size=test_size,
                    random_state=RANDOM_SEED,
                    stratify=data[strat_col],
                )
            except ValueError:
                pass
        # Fallback: stratify on label only
        return train_test_split(
            data, test_size=test_size,
            random_state=RANDOM_SEED,
            stratify=data["label"],
        )

    # Build combined strat column
    df = df.copy()
    df["_strat"] = df["label"].astype(str) + "|" + df["language"].fillna("unknown")

    train, rest = _safe_split(df, test_size=1.0 - train_frac, strat_col="_strat")

    val_frac_of_rest = val_frac / (1.0 - train_frac)
    rest = rest.copy()
    rest["_strat"] = rest["label"].astype(str) + "|" + rest["language"].fillna("unknown")
    val, test = _safe_split(rest, test_size=1.0 - val_frac_of_rest, strat_col="_strat")

    for split in (train, val, test):
        split.drop(columns=["_strat"], inplace=True, errors="ignore")

    return train.reset_index(drop=True), val.reset_index(drop=True), test.reset_index(drop=True)


def main():
    parser = argparse.ArgumentParser(description="Prepare dataset for XLM-RoBERTa fine-tuning")
    parser.add_argument("--input", help="Path to CSV/JSONL input dataset")
    parser.add_argument("--synthetic-per-class", type=int, default=400,
                        help="If no input, generate this many per class (synthetic)")
    parser.add_argument("--balance", choices=["weights", "upsample", "none"], default="weights",
                        help="Dataset balancing strategy (default: weights)")
    parser.add_argument("--min-length", type=int, default=5)
    parser.add_argument("--max-length", type=int, default=256)
    args = parser.parse_args()

    # 1. Load
    df = load_source_dataset(args)
    print(f"[LOAD] Total rows: {len(df)}")

    # 2. Preprocess
    df["text"] = df["text"].progress_apply(preprocess)
    df["length"] = df["text"].str.len()
    df = df[(df["length"] >= args.min_length) & (df["length"] <= 512)].copy()

    # 3. Language filter
    if "language" not in df.columns:
        df["language"] = df["text"].progress_apply(detect_lang_taglish)
    lang_counts = df["language"].value_counts().to_dict()
    print(f"[LANG] Detected languages: {lang_counts}")
    df = df[df["language"].isin({"tl", "en", "mixed"})].copy()

    # 4. Label validation
    df["label_norm"] = df["label"].progress_apply(normalize_label)
    invalid = df[df["label_norm"].isna()]
    if len(invalid):
        print(f"[WARN] Dropping {len(invalid)} rows with invalid labels.")
    df = df.dropna(subset=["label_norm"]).copy()
    df["label"] = df["label_norm"]
    df = df.drop(columns=["label_norm"])

    print(f"[CLEAN] After cleaning: {len(df)} rows")

    # 5. Split
    train, val, test = split_dataset(df)
    print(f"[SPLIT] train={len(train)}  val={len(val)}  test={len(test)}")

    # 6. Balance (on TRAIN only — never balance val/test!)
    train, meta = balance_dataset(train, strategy=args.balance)

    # 7. Save splits
    train_path = DATA_DIR / "train.csv"
    val_path = DATA_DIR / "val.csv"
    test_path = DATA_DIR / "test.csv"
    train.to_csv(train_path, index=False)
    val.to_csv(val_path, index=False)
    test.to_csv(test_path, index=False)
    print(f"\n[SAVE] Saved train/val/test splits to {DATA_DIR}/")

    # 8. Report
    def split_counts(data: pd.DataFrame, name: str) -> dict:
        c = data["label"].value_counts().to_dict()
        return {k: c.get(k, 0) for k in LABELS}

    report = {
        "meta": {
            "date": pd.Timestamp.now().isoformat(),
            "balance_strategy": args.balance,
            **meta,
        },
        "label_names": LABELS,
        "language_counts": lang_counts,
        "length_stats": {
            "train": round(float(train["length"].mean()), 1),
            "val": round(float(val["length"].mean()), 1),
            "test": round(float(test["length"].mean()), 1),
        },
        "counts": {
            "train": split_counts(train, "train"),
            "val": split_counts(val, "val"),
            "test": split_counts(test, "test"),
        },
        "sizes": {"train": len(train), "val": len(val), "test": len(test)},
    }
    report_path = OUT_DIR / "01_dataset_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"[REPORT] Saved dataset report → {report_path}")
    print("\nDone! 🎯 Next step: python 02_finetune_xlmroberta.py")


if __name__ == "__main__":
    main()
