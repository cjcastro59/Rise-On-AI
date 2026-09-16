# AWS Deployment Guide — Rise On AI Inference Server

## Option A: AWS Lightsail (RECOMMENDED — simplest)
Cost: ~$5/month (covered by $200 credit for 6 months)
RAM: 1GB | Storage: 40GB SSD

### Steps:
1. Go to https://lightsail.aws.amazon.com
2. Create instance → Linux/Unix → OS Only → Amazon Linux 2023
3. Choose $5/month plan (1GB RAM)
4. Name it: `rise-on-ai-sentiment`
5. Click Create

Once running:
```bash
# SSH into the instance (click "Connect using SSH" in Lightsail console)
sudo yum update -y
sudo yum install -y docker git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Clone your repo
git clone https://github.com/cjcastro59/Rise-On-AI.git
cd Rise-On-AI/scripts/inference-server

# Set your HF token
export HF_TOKEN=YOUR_HF_TOKEN_HERE

# Build and run
docker build -t sentiment-server .
docker run -d \
  --name sentiment \
  --restart unless-stopped \
  -p 80:10000 \
  -e HF_TOKEN=$HF_TOKEN \
  -e PORT=10000 \
  sentiment-server

# Check logs
docker logs -f sentiment
```

6. In Lightsail → Networking → Add rule: HTTP port 80
7. Your URL: http://[lightsail-public-ip]/predict

---

## Option B: EC2 t2.small (2GB RAM, ~$17/month)
1. Go to EC2 Console → Launch Instance
2. AMI: Amazon Linux 2023
3. Instance type: t2.small (2GB RAM)
4. Security group: allow HTTP (80) and SSH (22)
5. Same Docker commands as above

---

## After deployment:
Update SENTIMENT_MODEL_API_URL in Vercel to:
  http://[your-aws-public-ip]/predict
  
Or add a domain name via Lightsail for a cleaner URL.
