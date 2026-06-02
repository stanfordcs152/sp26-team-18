# Evaluation dataset sources

TruthGuard Milestone 3 uses **politically themed** real and synthetic images. Primary source: **OpenFake**. Optional supplement: **Deepfake-Eval-2024**.

## Primary: OpenFake

| | |
|---|---|
| **Hub** | https://huggingface.co/datasets/ComplexDataLab/OpenFake |
| **Focus** | Politically salient real vs synthetic pairs (LAION-filtered reals, multi-generator fakes) |
| **License** | CC-BY-SA-4.0 (some proprietary-generator subsets: non-commercial; see paper) |
| **Our mapping** | `real` → **allow** · `fake` → **unallow** |

**Citation (BibTeX):**

```bibtex
@misc{livernoche2025openfakeopendatasetplatform,
  title={OpenFake: An Open Dataset and Platform Toward Real-World Deepfake Detection},
  author={Victor Livernoche and Akshatha Arodi and Andreea Musulan and Zachary Yang and Adam Salvail and Ga{\'e}tan Marceau Caron and Jean-Fran{\c{c}}ois Godbout and Reihaneh Rabbany},
  year={2025},
  eprint={2509.09495},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  url={https://arxiv.org/abs/2509.09495},
}
```

**Why not FaceForensics++ / Celeb-DF?** Those benchmarks target celebrity face-swaps in controlled video frames, not political memes, protests, disaster imagery, or news-style synthetic screenshots—the abuse type TruthGuard targets.

## Optional supplement: Deepfake-Eval-2024

| | |
|---|---|
| **Hub** | https://huggingface.co/datasets/nuriachandra/Deepfake-Eval-2024 |
| **Focus** | In-the-wild deepfakes circulated on social media in 2024 (~1,975 images) |
| **Access** | Gated (institutional / research verification on Hugging Face) |
| **License** | CC-BY-SA-4.0 |

**Citation:**

```bibtex
@misc{chandra2025deepfakeeval2024multimodalinthewildbenchmark,
  title={Deepfake-Eval-2024: A Multi-Modal In-the-Wild Benchmark of Deepfakes Circulated in 2024},
  author={Nuria Alina Chandra and Ryan Murtfeldt and Lin Qiu and others},
  year={2025},
  eprint={2503.02857},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  url={https://arxiv.org/abs/2503.02857},
}
```

Use this to add **in-the-wild** diversity on top of OpenFake; it is less politically targeted than OpenFake but closer to deployed social feeds.

## Collection method (for the report)

1. Run `npm run eval:setup-openfake` with fixed `--seed` for reproducibility.
2. Optionally run `npm run eval:setup-deepfake-eval` after HF access approval.
3. Verify with `npm run eval -- --dry-run`.
4. Commit `evals/allow/images/`, `evals/unallow/images/`, and both `manifest.jsonl` files (or document hash + download commands if images are too large for git).
