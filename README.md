# 💰 WealthManager

<p align="center">
  <img src="frontend/assets/images/logo.png" alt="WealthManager Logo" width="200"/>
</p>

A comprehensive personal finance management platform available as a mobile app and web application, designed to help users take control of their financial lives with powerful features and an intuitive interface.

🌐 **[Try Web App](https://alanjumeaucourt.github.io/wealth_manager/app)** |
🎯 **[View Mobile App Showcase](https://alanjumeaucourt.github.io/wealth_manager)**

## 🎯 Platform Overview

WealthManager is available in two formats, with a showcase website:

### 📱 Mobile Application (Coming Soon)
Our flagship mobile app built with React Native and Expo, perfect for on-the-go finance management.

Key Features:
- 📊 Real-time wealth tracking and visualization
- 💳 Multi-account management with bank integration
- 📈 Investment portfolio tracking and analysis
- 💰 Smart budgeting and expense analytics
- 🔄 Intelligent transaction management

[View mobile app showcase](frontend/README.md)

### 🖥️ Web Application
A full-featured web version offering enhanced visualization and keyboard shortcuts for power users.

Features:
- 🖥️ Desktop-optimized interface
- 🚀 Real-time data synchronization
- 📊 Advanced data visualization
- ⌨️ Keyboard shortcuts support
- 🔄 Seamless backend integration

### 🌐 Showcase Website
A static website demonstrating the mobile app's features and capabilities to potential users.

## 🏗 Technical Architecture

### Backend (Common)
Powers both web and mobile applications:
- **Framework**: Flask
- **Database**: SQLite ([Schema Documentation](DATABASE_STRUCTURE.md))
- **Authentication**: JWT & Flask-JWT-Extended
- **API Documentation**: OpenAPI/Swagger
- **Error Tracking**: Sentry

### Mobile App Frontend
- **Framework**: React Native with Expo
- **State Management**: Redux
- **UI Components**: React Native Paper
- **Charts**: React Native Gifted Charts
- **Navigation**: Expo Router

### Web Application Frontend
- **Framework**: React + Vite
- **Runtime**: Bun
- **Router**: TanStack Router
- **State Management**: TanStack Query
- **API Integration**: Direct backend integration

### Showcase Website
- **Framework**: React + Vite + TypeScript
- **Deployment**: GitHub Pages
- **Analytics**: Google Analytics

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Bun (for web application)
- Python 3.12+ (for backend)
- Expo CLI (for mobile)

### Quick Start

1. Backend:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
SQLITE_DB_PATH=database_directory python3 run.py
```

You can populate the database with the following command:
```bash
BACKEND_URL=http://localhost:5000 python3 backend/test/add_api_fake_data.py --months 12
```

1. Web Application:
```bash
cd web_application
bun install
VITE_API_URL=http://localhost:5000 bun run dev --host
```

1. Mobile App:
```bash
cd frontend
npm install
expo start
```

1. Showcase Website:
```bash
cd showcase_website
npm install
npm run dev
```

## 📚 Documentation
- [API Documentation](backend/README.md)
- [Mobile App Guide](frontend/README.md)
- [Database Structure](DATABASE_STRUCTURE.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## 🛠 Development

The project uses GitHub Actions for CI/CD with separate deployment pipelines for:
- Web Application (`/app`)
- Showcase Website (`/`)
- Mobile App (Expo)

