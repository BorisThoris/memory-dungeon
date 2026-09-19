"""Draft reel copy with the local Qwen3 LM that ships inside Z-Image-Turbo (its text encoder).

Prints twelve candidate three-beat scripts as JSON; the pick is made by hand afterwards.
"""
import json
import sys
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

SNAP = r"D:\hf-cache\hub\models--Tongyi-MAI--Z-Image-Turbo\snapshots\f332072aa78be7aecdf3ee76d5c247082da564a6"
tok = AutoTokenizer.from_pretrained(SNAP + r"\tokenizer")
model = AutoModelForCausalLM.from_pretrained(SNAP + r"\text_encoder", torch_dtype=torch.bfloat16).to("cuda")
model.eval()

brief = (
    "You write ad copy for game trailers. The game is Memory Dungeon, a dark-fantasy memory roguelite: "
    "you study a board of face-up cards for a few seconds, the cards turn over, and you match the pairs from memory; "
    "matching pairs in a row builds a chain (Clean, Sharp, Fever) that pops whole clumps of cards and multiplies the score; "
    "every floor deals a deeper, harder board. Tone: quiet, confident, a little ominous; short words; no exclamation marks; "
    "no emoji; no hashtags.\n\n"
    "Write a script for a 10-second vertical Instagram ad with exactly four on-screen lines:\n"
    "1. HOOK (2-4 words) shown over a single card turning face up\n"
    "2. STUDY (2-5 words) shown over a board of cards revealed then hidden\n"
    "3. CHAIN (2-5 words) shown over a chain of matches popping cards\n"
    "4. CLOSE (3-7 words) shown with the title card and the line 'Play free in your browser'\n"
    "Answer with JSON only: {\"hook\": ..., \"study\": ..., \"chain\": ..., \"close\": ...}"
)

outs = []
for seed in range(12):
    torch.manual_seed(1000 + seed)
    messages = [{"role": "user", "content": brief}]
    text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
    ids = tok(text, return_tensors="pt").to("cuda")
    with torch.no_grad():
        gen = model.generate(**ids, max_new_tokens=120, do_sample=True, temperature=0.9, top_p=0.92, repetition_penalty=1.1)
    reply = tok.decode(gen[0][ids["input_ids"].shape[1]:], skip_special_tokens=True).strip()
    outs.append(reply)
    print(seed, reply.replace("\n", " "), flush=True)

json.dump(outs, open(sys.argv[1], "w", encoding="utf-8"), indent=2, ensure_ascii=False)
