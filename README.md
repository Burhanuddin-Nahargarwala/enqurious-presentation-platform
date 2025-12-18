# Enqurious | Presentation Portal

A modern, full-stack web application for creating, managing, and sharing HTML-based presentations. Built with the MERN stack (MongoDB, Express, React, Node.js).

![Enqurious Logo](frontend/src/assets/enqurious-logo.png)

## Features

### for Presenters & Authors
-   **In-Browser Authoring**: Create presentations from scratch directly in the browser.
-   **Slide Management**: Add, edit, and delete HTML slides with a live code editor.
-   **ZIP Upload**: Upload existing HTML presentations as ZIP files.
-   **Thumbnail Support**: Add custom cover images for your presentations.
-   **Dashboard**: Manage all your presentations in one place.
-   **View Counters**: Track how many times your presentation has been viewed.

### for Viewers
-   **Public Access**: View presentations without logging in.
-   **Social Sharing**: Easily copy presentation links to share with others.
-   **Responsive Design**: Works seamlessly on desktop and mobile devices.

## Tech Stack

-   **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion, Lucide React
-   **Backend**: Node.js, Express.js
-   **Database**: MongoDB (Mongoose)
-   **Authentication**: JWT (JSON Web Tokens)
-   **File Handling**: Multer (for uploads), Unzipper

## Installation & Local Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Burhanuddin-Nahargarwala/enqurious-presentation-platform.git
    cd enqurious-presentation-platform
    ```

2.  **Install Dependencies**
    ```bash
    # Install backend dependencies
    cd backend
    npm install

    # Install frontend dependencies
    cd ../frontend
    npm install
    ```

3.  **Environment Setup**
    -   Create a `.env` file in the `backend` directory (see `backend/.env.example` if available, or use the guide below).
    -   Create a `.env` file in the `frontend` directory.

    **Backend `.env`**:
    ```env
    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret
    CORS_ORIGIN=http://localhost:5173
    ```

    **Frontend `.env`**:
    ```env
    VITE_API_URL=http://localhost:5000/api
    ```

4.  **Run the Application**
    Open two terminals:

    **Terminal 1 (Backend)**:
    ```bash
    cd backend
    npm start
    ```

    **Terminal 2 (Frontend)**:
    ```bash
    cd frontend
    npm run dev
    ```

5.  **Access the App**
    Open [http://localhost:5173](http://localhost:5173) in your browser.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
