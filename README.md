# Next-Go-Template

This template repository provides a simple setup for running a **Next.js frontend** with a **Go backend**. The frontend and backend are run separately, allowing for independent development and deployment.

## Steps to Set Up and Run

### 1. Navigate to the Frontend Directory

After creating the repository, go to the frontend directory:

   ```bash
   cd frontend
   ```

2. **Install Dependencies**

   Run the following command to install the required dependencies for the frontend:

```bash
npm install
```
3. **Run the Frontend Application**

   To start the application, run:

```bash
npm run dev
```

4. **Open new terminal**   

5. **Navigate to the Backend Directory**

```bash
cd backend
```

6. **Run the Go Backend**

```bash
go run main.go
```

### Changing the Backend URL
If you need to change the backend URL (for example, when deploying or running on a different port), you will need to modify the .env.local file in the frontend directory. Update the NEXT_PUBLIC_GO_API variable to point to the new backend URL:

```bash
# change this to your backend api url
NEXT_PUBLIC_GO_API=http://new-backend-url:8080
```
### disclaimer
currently the .env is not being ignored in .gitignore