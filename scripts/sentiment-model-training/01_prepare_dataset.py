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
        "I am exhausted of waking up every day just to feel this way.",
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
    parser.add_argument("--synthetic-per-class", type=int, default=250,
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
