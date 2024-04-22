const express = require("express");
const cors = require("cors");
const Traceroute = require("nodejs-traceroute");
const mysql = require("mysql");
const app = express();
const PORT = 3001;
const ping = require("ping");

app.use(express.json());
app.use(
  cors({
    credentials: true,
  })
);

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "zlata",
  database: "modus",
});

connection.connect((err) => {
  if (err) {
    console.error("Ошибка подключения к базе данных: " + err.stack);
    return;
  }
  console.log("Успешное подключение к базе данных");
});

// Ручки
app.get("/getData", (req, res) => {
  connection.query("SELECT * FROM resources", (error, results, fields) => {
    if (error) {
      console.error("Ошибка выполнения запроса: " + error.stack);
      res.status(500).send("Произошла ошибка при выполнении запроса");
      return;
    }

    res.json(results); // Отправляем результаты в формате JSON
  });
});

app.post("/addData", (req, res) => {
  const { name, ip } = req.body;
  if (!name || !ip) {
    return res.status(400).json({ error: "Name and ip are required" });
  }

  const resource = { name, ip };

  try {
    connection.query(
      "INSERT INTO resources SET ?",
      resource,
      (error, results, fields) => {
        if (error) {
          console.error("Error executing query:", error);
          res.status(500).json({ error: "Error adding data to database" });
          return;
        }
        console.log("Data added successfully:", results);
        res.status(201).json({
          message: "Data added successfully",
          resourceId: results.insertId,
        });
      }
    );
  } catch (error) {
    console.error("Error adding data to database:", error);
    res.status(500).json({ error: "Error adding data to database" });
  }
});

app.put("/editData/:id", (req, res) => {
  const resourceId = req.params.id;
  const { name, ip } = req.body;
  if (!resourceId || !name || !ip) {
    return res
      .status(400)
      .json({ error: "Resource ID, name, and description are required" });
  }

  const updatedResource = { name, ip };

  try {
    connection.query(
      "UPDATE resources SET ? WHERE id = ?",
      [updatedResource, resourceId],
      (error, results, fields) => {
        if (error) {
          console.error("Error executing query:", error);
          res.status(500).json({ error: "Error updating data in database" });
          return;
        }
        if (results.affectedRows === 0) {
          return res.status(404).json({ error: "Resource not found" });
        }
        console.log("Data updated successfully:", results);
        res.json({ message: "Data updated successfully" });
      }
    );
  } catch (error) {
    console.error("Error updating data in database:", error);
    res.status(500).json({ error: "Error updating data in database" });
  }
});

app.delete("/clearData", (req, res) => {
  try {
    const query = "UPDATE resources SET ping = NULL, nodes = NULL";
    connection.query(query, (error, results, fields) => {
      if (error) {
        console.error("Ошибка выполнения запроса: " + error.stack);
        res.status(500).send("Произошла ошибка при выполнении запроса");
        return;
      }
      console.log(
        "Значения столбцов ping и nodes успешно очищены для всех записей"
      );
      res
        .status(200)
        .send(
          "Значения столбцов ping и nodes успешно очищены для всех записей"
        );
    });
  } catch (error) {
    console.error("Ошибка при очистке данных:", error);
    res.status(500).json({ error: "Ошибка при очистке данных" });
  }
});

app.delete("/deleteData/:id", (req, res) => {
  const resourceId = req.params.id;
  if (!resourceId) {
    return res.status(400).json({ error: "Resource ID is required" });
  }

  try {
    connection.query(
      "DELETE FROM resources WHERE id = ?",
      resourceId,
      (error, results, fields) => {
        if (error) {
          console.error("Error executing query:", error);
          res.status(500).json({ error: "Error deleting data from database" });
          return;
        }
        if (results.affectedRows === 0) {
          return res.status(404).json({ error: "Resource not found" });
        }
        console.log("Data deleted successfully:", results);
        res.json({ message: "Data deleted successfully" });
      }
    );
  } catch (error) {
    console.error("Error deleting data from database:", error);
    res.status(500).json({ error: "Error deleting data from database" });
  }
});

app.get("/api/ping", async (req, res) => {
  try {
    // Получаем все записи из базы данных
    connection.query(
      "SELECT * FROM resources",
      async (error, results, fields) => {
        if (error) {
          console.error("Ошибка выполнения запроса:", error);
          return res.status(500).json({ error: "Ошибка выполнения запроса" });
        }

        // Перебираем каждую запись и проверяем ping
        for (const resource of results) {
          const { id, ip } = resource;
          await pingAndUpdate(id, ip, res); // Функция для проверки ping и обновления записи в БД
        }

        console.log(
          "Ping успешно проверен и записан в базу данных для всех записей"
        );
        res.json({
          message:
            "Ping успешно проверен и записан в базу данных для всех записей",
        });
      }
    );
  } catch (error) {
    console.error("Ошибка при проверке ping:", error);
    res.status(500).json({ error: "Ошибка при проверке ping" });
  }
});

// Функция для выполнения операции ping и обновления значения в базе данных
async function pingAndUpdate(id, host, res) {
  if (!host) {
    console.error("Hostname is required");
    return;
  }

  try {
    const result = await ping.promise.probe(host); // Выполняем операцию ping

    let pingValue;
    if (result.alive) {
      pingValue = result.time ? result.time : 0; // Если хост живой, записываем время, иначе 1
    } else {
      pingValue = 0; // Если ресурс недоступен, устанавливаем значение 0
    }

    // Обновляем значение ping в базе данных
    updatePingInDatabase(id, pingValue, res);
  } catch (error) {
    console.error("Error during ping:", error);
    // Обрабатываем ошибку здесь, если необходимо
    // Например, устанавливаем значение 0 в случае ошибки
    updatePingInDatabase(id, 0, res);
  }
}

// Функция для обновления значения ping в БД
function updatePingInDatabase(id, ping, res) {
  const query = "UPDATE resources SET ping = ? WHERE id = ?";
  connection.query(query, [ping, id], (error, results, fields) => {
    if (error) {
      console.error("Ошибка при обновлении значения ping в БД:", error);
    } else {
      console.log(`Значение ping для записи с id ${id} успешно обновлено в БД`);
    }
  });
}


// Функция для выполнения трассировки маршрута
app.get("/api/traceroute", async (req, res) => {
  try {
    // Fetch all records from the database
    connection.query(
      "SELECT * FROM resources",
      async (error, results, fields) => {
        if (error) {
          console.error("Error executing query:", error);
          return res.status(500).json({ error: "Error executing query" });
        }

        // Создаем массив промисов для операций трассировки маршрута
        const traceroutePromises = results.map(async (resource) => {
          const { id, ip } = resource;
          try {
            const data = await performTraceroute(ip);
            await saveTracerouteResults(id, data);
          } catch (error) {
            console.error(`Error performing traceroute for IP ${ip}:`, error);
          }
        });

        // Ожидаем завершения всех операций трассировки маршрута
        await Promise.all(traceroutePromises);

        console.log("Traceroute completed for all IPs");
        res.json({ message: "Traceroute completed for all IPs" });
      }
    );
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Error" });
  }
});

// Функция для выполнения трассировки маршрута
async function performTraceroute(ip) {
  return new Promise((resolve, reject) => {
    if (!ip || ip.trim() === "") {
      // Check if IP address is empty
      console.log("Empty IP detected. Skipping traceroute.");
      resolve([]); // Return empty array if IP address is empty
      return;
    }

    const tracer = new Traceroute();
    const hops = [];

    tracer
      .on("hop", (hop) => {
        if (hop.ip !== "") {
          // Exclude hops with empty IP addresses
          hops.push(hop);
        }
      })
      .on("close", () => {
        console.log("Traceroute completed for IP:", ip);
        resolve(hops);
      })
      .on("error", (error) => {
        console.error("Error during traceroute:", error);
        reject(error);
      });

    tracer.trace(ip);
  });
}

// Function to save traceroute results to the database
async function saveTracerouteResults(id, hops) {
  return new Promise((resolve, reject) => {
    const query = "UPDATE resources SET nodes = ? WHERE id = ?";
    connection.query(query, [hops.length, id], (error, results, fields) => {
      if (error) {
        console.error("Ошибка при обновлении значения ping в БД:", error);
        reject(error);
      } else {
        console.log(
          `Значение traceroute для записи с id ${id} успешно обновлено в БД`
        );
        resolve(results);
      }
    });
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
