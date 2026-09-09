import torch
print("torch OK:", torch.__version__)
print("device:", "cuda" if torch.cuda.is_available() else "cpu")
