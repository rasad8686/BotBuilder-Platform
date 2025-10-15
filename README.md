\# 🤖 BotBuilder Platform



Full-Stack Bot Builder Platform - Create, manage, and deploy chatbots with React, Node.js, and PostgreSQL.



---



\## 🌟 Features



✅ User Authentication (JWT)  

✅ Bot Management (CRUD)  

✅ Message System with Triggers  

✅ Analytics Dashboard  

✅ Responsive Design  

✅ Multi-Platform Support  



---



\## 🛠️ Tech Stack



\*\*Frontend:\*\* React, Tailwind CSS, Vite, React Router  

\*\*Backend:\*\* Node.js, Express.js, PostgreSQL, JWT, bcrypt  



---



\## 🚀 Quick Start



\### Installation

```bash

\# Clone repository

git clone https://github.com/rasad8686/BotBuilder-Platform.git

cd BotBuilder-Platform



\# Install dependencies

npm install

cd client \&\& npm install \&\& cd ..



\# Setup database

createdb botbuilder

npm run migrate



\# Run application

npm run dev          # Backend (Terminal 1)

cd client \&\& npm run dev  # Frontend (Terminal 2)

```



\### Environment Variables



Create `.env` file:

```

PORT=3000

DATABASE\_URL=postgresql://username:password@localhost:5432/botbuilder

JWT\_SECRET=your\_secret\_key

```



---



\## 📁 Project Structure

```

BotBuilder-Platform/

├── client/          # React frontend

├── routes/          # API routes

├── middleware/      # Auth middleware

├── config/          # Database config

└── server.js        # Express server

```



---



\## 🔐 API Endpoints



\*\*Auth:\*\* `/api/auth/register`, `/api/auth/login`  

\*\*Bots:\*\* `/api/bots` (GET, POST, PUT, DELETE)  

\*\*Messages:\*\* `/api/messages/:botId` (GET, POST, DELETE)  



---



\## 📦 Deployment



\*\*Frontend:\*\* Vercel  

\*\*Backend:\*\* Railway  

\*\*Database:\*\* Railway PostgreSQL  



---



\## 👤 Author



\*\*Rashad\*\*  

GitHub: \[@rasad8686](https://github.com/rasad8686)



---



⭐ Star this repo if you find it helpful!



Made with ❤️ by Rashad

