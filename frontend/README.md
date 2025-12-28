# BomberNet – Social Gaming Platform

BomberNet is a full-stack social gaming platform that combines a social network with a real-time multiplayer game.  
The system integrates user profiles, authentication, social interactions, and a Bomberman-style real-time game with WebSocket communication.

The project is developed as part of the **IT Project module** and follows modern software engineering practices, including containerization, service separation, and real-time communication.

---
## ▶ Running the Project

The project can be run in **two ways**:
1. Using **Docker (recommended)**
2. Using **manual local setup (without Docker)**

---

##  Option 1: Run Using Docker (Recommended)

### Prerequisites
- Docker Desktop installed and running
- Docker Compose enabled

---

### Steps

1. Navigate to the project root directory:
```bash
cd <project-root>
Build and start all services:

bash

docker compose up --build
This will:

Build all Docker images

Start the frontend, backend, and game server

Create an internal Docker network

Apply database migrations automatically

Access the Application
Service	URL
Frontend	http://localhost:3000
Backend API	http://localhost:8080
Game WebSocket	ws://localhost:8081

Stop the Application
bash

docker compose down
Option 2: Run Manually (Without Docker)
Prerequisites
Node.js (v18+ recommended)

Go (v1.22+ recommended)

SQLite installed

npm installed

Step 1: Run the Backend (Go API)
bash
 
cd backend
go mod download
go run main.go
Backend will start at:

arduino

http://localhost:8080
Step 2: Run the Game Server (WebSocket)
bash

cd frontend
npm install
node server.js
Game WebSocket server will start at:

arduino

ws://localhost:8081
Step 3: Run the Frontend (Next.js)
Open a new terminal window:

bash

cd frontend
npm install
npm run dev
Frontend will be available at:

arduino

http://localhost:3000
##  Features

### Social Network
- User registration and login
- Session-based authentication
- User profiles
- Follow system
- Secure API endpoints
- SQLite database with migrations

### Real-Time Game
- Multiplayer Bomberman-style game
- WebSocket server for real-time communication
- Player movement, bombs, and interactions
- Real-time synchronization between players

### Technical
- Dockerized multi-service architecture
- Frontend, backend, and game server isolated as separate services
- Persistent database storage using Docker volumes
- Internal Docker networking for secure service communication

---

##  Project Architecture

The system is split into **three main services**:

| Service | Technology | Purpose |
|------|-----------|--------|
| Frontend | Next.js (Node.js) | UI, pages, client logic |
| Backend | Go | API, authentication, database logic |
| Game Server | Node.js | WebSocket real-time game server |

All services are orchestrated using **Docker Compose** and communicate over an internal Docker network.

---

## Project Structure

.
├── backend/ # Go backend (API + database)
│ ├── handlers/
│ ├── database/
│ ├── Dockerfile
│ └── main.go
│
├── frontend/ # Next.js frontend + game server
│ ├── pages/
│ ├── components/
│ ├── game/
│ ├── server.js # Game WebSocket server
│ ├── Dockerfile
│ ├── Dockerfile.game
│ └── next.config.mjs
│
├── docker-compose.yml # Multi-container orchestration
└── README.md



---

##  Docker Setup (Recommended Way)

### Prerequisites
- Docker Desktop installed and running
- Docker Compose enabled

---

### ▶ Run the project

From the project root:

```bash
docker compose up --build
This command will:

Build all images

Start all services

Create a shared Docker network

Apply database migrations automatically

 Access the system
Service	URL
Frontend	http://localhost:3000
Backend API	http://localhost:8080
Game WebSocket	ws://localhost:8081

⏹ Stop the project

docker compose down
 Environment Variables
The frontend uses environment variables to communicate with backend services:


NEXT_PUBLIC_API_URL=http://backend:8080
NEXT_PUBLIC_GAME_WS_URL=ws://game:8081
These values work inside Docker Compose using service DNS names.

 Database
SQLite is used for persistence

Database files are stored in a Docker volume

Migrations are applied automatically on backend startup

Volume used:


sqlite_data
Testing & Verification
To verify the system is running correctly:


curl http://localhost:8080/api/me
Expected responses:

401 Unauthorized → user not logged in

200 OK → valid session

 Key Technical Highlights
Service isolation using Docker

Real-time WebSocket communication

Secure session-based authentication

Clean separation of concerns

Production-ready deployment structure

Scalable architecture suitable for future expansion

Academic Context
This project is developed for the IT Project module and demonstrates:

Full-stack development

Real-time systems

Deployment and DevOps practices

Software architecture design

Practical application of networking concepts

Author
Reem Halwachi
IT Project – Social Gaming Platform