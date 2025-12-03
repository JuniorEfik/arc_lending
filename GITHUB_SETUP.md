# GitHub Setup Guide

Follow these steps to connect your project to GitHub and push your code.

## ✅ Step 1: Initial Commit (Already Done)
Git repository has been initialized and files are staged.

## Step 2: Create Initial Commit

```bash
git commit -m "Initial commit: Arc Lending DeFi platform"
```

## Step 3: Create GitHub Repository

### Option A: Using GitHub Website (Recommended)
1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right corner
3. Select **"New repository"**
4. Fill in the details:
   - **Repository name**: `arc-lending` (or your preferred name)
   - **Description**: "DeFi & Capital Markets Platform for Arc Network"
   - **Visibility**: Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click **"Create repository"**

### Option B: Using GitHub CLI (if installed)
```bash
gh repo create arc-lending --public --source=. --remote=origin --push
```

## Step 4: Add GitHub Remote

After creating the repository on GitHub, you'll see a URL like:
- HTTPS: `https://github.com/YOUR_USERNAME/arc-lending.git`
- SSH: `git@github.com:YOUR_USERNAME/arc-lending.git`

**Replace `YOUR_USERNAME` with your actual GitHub username**, then run:

```bash
# For HTTPS (recommended for beginners)
git remote add origin https://github.com/YOUR_USERNAME/arc-lending.git

# OR for SSH (if you have SSH keys set up)
git remote add origin git@github.com:YOUR_USERNAME/arc-lending.git
```

## Step 5: Rename Branch to Main (Optional but Recommended)

GitHub uses `main` as the default branch name:

```bash
git branch -M main
```

## Step 6: Push to GitHub

```bash
git push -u origin main
```

If you used `master` instead of `main`, use:
```bash
git push -u origin master
```

## Step 7: Authenticate (if prompted)

- **HTTPS**: You'll be prompted for username and password/token
  - Use a Personal Access Token (PAT) instead of password
  - Create one at: https://github.com/settings/tokens
- **SSH**: Should work automatically if SSH keys are configured

## Troubleshooting

### If you get "remote origin already exists":
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/arc-lending.git
```

### If you need to update the remote URL:
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/arc-lending.git
```

### To verify remote is set correctly:
```bash
git remote -v
```

## Next Steps After Pushing

1. ✅ Your code is now on GitHub!
2. Set up branch protection rules (Settings → Branches)
3. Add collaborators if needed (Settings → Collaborators)
4. Enable GitHub Actions for CI/CD (if needed)
5. Create issues and project boards for task management

## Quick Reference Commands

```bash
# Check status
git status

# See what will be committed
git status --short

# View remote
git remote -v

# Push updates (after initial push)
git add .
git commit -m "Your commit message"
git push
```

