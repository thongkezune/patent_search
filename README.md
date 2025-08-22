# Patent Search & Download App - Windows Deployment Guide

## 📋 Prerequisites

1. **Node.js**: Download and install from [nodejs.org](https://nodejs.org/)

   - Choose the LTS version (recommended)
   - This includes npm (Node Package Manager)

2. **Git** (optional): Download from [git-scm.com](https://git-scm.com/download/win)

## 🚀 Quick Setup Instructions

### Step 1: Create Project Directory

```cmd
mkdir patent-search-app
cd patent-search-app
```

### Step 2: Create package.json

Create a file named `package.json` with this content:

```json
{
  "name": "patent-search-app",
  "version": "1.0.0",
  "description": "Patent search and download application with WIPO and Google Patents integration",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "install-deps": "npm install"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "axios": "^1.6.0",
    "puppeteer": "^21.0.0",
    "cheerio": "^1.0.0-rc.12",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=16.0.0"
  },
  "keywords": ["patents", "search", "download", "wipo", "google-patents"],
  "author": "Your Name",
  "license": "MIT"
}
```

### Step 3: Create Project Structure

Create these folders and files:

```
patent-search-app/
├── server.js              (Backend server - copy from artifact above)
├── package.json           (Dependencies file)
├── public/
│   └── index.html         (Frontend - copy from first artifact)
├── temp/                  (Auto-created for downloads)
└── README.md             (This file)
```

### Step 4: Install Dependencies

Open Command Prompt or PowerShell in your project directory and run:

```cmd
npm install
```

This will install all required packages:

- `express`: Web server framework
- `cors`: Cross-origin resource sharing
- `axios`: HTTP client for API requests
- `puppeteer`: Browser automation for PDF generation
- `cheerio`: HTML parsing
- `node-fetch`: HTTP requests

### Step 5: Create the Files

1. **Create server.js**: Copy the backend server code from the second artifact
2. **Create public/index.html**: Copy the enhanced frontend code from the first artifact
3. **Create public folder**:
   ```cmd
   mkdir public
   ```

### Step 6: Run the Application

```cmd
npm start
```

Or for development with auto-reload:

```cmd
npm run dev
```

### Step 7: Access the Application

1. Open your web browser
2. Navigate to: `http://localhost:3000`
3. The patent search interface should load

## 🔧 Advanced Configuration

### Environment Variables

Create a `.env` file for configuration:

```
PORT=3000
NODE_ENV=development
DOWNLOAD_PATH=./temp
MAX_CONCURRENT_DOWNLOADS=5
```

### Puppeteer Configuration

If you encounter issues with Puppeteer on Windows:

```cmd
# Install Chromium separately if needed
npx puppeteer browsers install chrome
```

## 📖 How to Use

1. **Start the backend server**: Run `npm start`
2. **Open the web interface**: Go to `http://localhost:3000`
3. **Test connection**: Click "Test Connection" to verify backend is running
4. **Search patents**: Enter keywords and click "Search Patents"
5. **Download PDFs**: Click "Download PDF" on any patent result

## 🔍 Features

- **Real Patent Search**: Integrates with Google Patents search
- **PDF Download**: Downloads actual patent PDF files
- **Duplicate Detection**: Intelligent filtering of similar patents
- **Batch Operations**: Download multiple patents at once
- **Progress Tracking**: Real-time progress indicators
- **Responsive Design**: Works on desktop and mobile

## 🛠 Troubleshooting

### Common Issues:

1. **Port already in use**:

   ```cmd
   # Change port in package.json or use:
   set PORT=3001 && npm start
   ```

2. **Puppeteer installation issues**:

   ```cmd
   npm install puppeteer --ignore-scripts
   npx puppeteer browsers install chrome
   ```

3. **Permission errors**:

   - Run Command Prompt as Administrator
   - Check Windows Defender/Antivirus settings

4. **Network issues**:
   - Check firewall settings
   - Ensure internet connection for patent APIs

### Windows-Specific Notes:

- Use `cmd` or `PowerShell` for commands
- Paths use backslashes (`\`) on Windows
- Downloaded files go to `temp/` folder in project directory
- Check Windows Defender if downloads are blocked

## 📁 File Structure After Setup

```
patent-search-app/
├── node_modules/          (npm packages)
├── public/
│   └── index.html         (Frontend interface)
├── temp/                  (Downloaded patent PDFs)
├── server.js              (Backend API server)
├── package.json           (Project configuration)
├── package-lock.json      (Auto-generated)
└── .env                   (Optional configuration)
```

## 🔒 Security Considerations

- This app runs locally on your computer
- No sensitive data is stored permanently
- Downloads are saved to local `temp/` folder
- Always respect patent database terms of service
- Consider rate limiting for production use

## 📞 Support

If you encounter issues:

1. Check the console output for error messages
2. Verify all dependencies are installed: `npm list`
3. Test internet connection to patent databases
4. Check Windows firewall and antivirus settings

## 🚀 Next Steps

- Add authentication for production deployment
- Implement patent family detection
- Add export to Excel/CSV functionality
- Create scheduled patent monitoring
- Add patent analysis features

---

**Note**: This application is for educational and research purposes. Always comply with patent database terms of service and applicable laws.
