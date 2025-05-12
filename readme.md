## 📘 BetaCrew Exchange Client

### 👷️ Overview

This Node.js application connects to the BetaCrew Exchange Server to retrieve stock ticker data and saves it as a JSON file.

---

### 🛠️ Prerequisites

- **Node.js**: Version 16.17.0 or higher.

  - Verify your Node.js version:

    ```bash
    node -v
    ```

---

### 🚀 Setup Instructions

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/ravi-dholaria/betacrew_exchange_server.git
   cd betacrew_exchange_client
   ```

2. **Start the Exchange Server**:

   - Navigate to the `betacrew_exchange_server` directory.
   - Start the server:

     ```bash
     cd betacrew_exchange_server
     node main.js
     ```

3. **Run the Client Application**:

   - Open a new terminal window.
   - Navigate to the client directory:

     ```bash
     cd betacrew_exchange_client
     node client.js
     ```

---

### 📂 Output

- The client will:

  - Connect to the exchange server.
  - Request all available stock ticker packets.
  - Detect and request any missing packets.
  - Save the complete data to `stock_data.json`.

---

### 📝 Notes

- **Logging**: Logs and errors are printed directly to the terminal and are not saved to a file.
- **Data Integrity**: The client ensures that all packet sequences are received without any gaps.
- **Error Handling**: Basic error handling is implemented to manage connection issues and unexpected data formats.

---
