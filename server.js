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
    console.error("Database connection error: " + err.stack);
    return;
  }
  console.log("Successful connection to the database");
});


app.get("/getData", (req, res) => {
  connection.query("SELECT * FROM resources", (error, results, fields) => {
    if (error) {
      console.error("Request execution error: " + error.stack);
      res.status(500).send("An error occurred while executing the request");
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
        console.error("Request execution error: " + error.stack);
        res.status(500).send("An error occurred while executing the request");
        return;
      }
      console.log(
        "The values of the ping and nodes columns have been successfully cleared for all records"
      );
      res
        .status(200)
        .send(
          "The values of the ping and nodes columns have been successfully cleared for all records"
        );
    });
  } catch (error) {
    console.error("Error when clearing data:", error);
    res.status(500).json({ error: "Error when clearing data" });
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
    connection.query(
      "SELECT * FROM resources",
      async (error, results, fields) => {
        if (error) {
          console.error("Request execution error:", error);
          return res.status(500).json({ error: "Request execution error" });
        }

        for (const resource of results) {
          const { id, ip } = resource;
          await pingAndUpdate(id, ip, res); 
        }

        console.log(
          "Ping has been successfully verified and recorded in the database for all records"
        );
        res.json({
          message:
            "Ping has been successfully verified and recorded in the database for all records",
        });
      }
    );
  } catch (error) {
    console.error("Ping verification error:", error);
    res.status(500).json({ error: "Ping verification error" });
  }
});

async function pingAndUpdate(id, host, res) {
  if (!host) {
    console.error("Hostname is required");
    return;
  }

  try {
    const result = await ping.promise.probe(host); 

    let pingValue;
    if (result.alive) {
      pingValue = result.time ? result.time : 0; 
    } else {
      pingValue = 0;
    }

    updatePingInDatabase(id, pingValue, res);
  } catch (error) {
    console.error("Error during ping:", error);
    updatePingInDatabase(id, 0, res);
  }
}

function updatePingInDatabase(id, ping, res) {
  const query = "UPDATE resources SET ping = ? WHERE id = ?";
  connection.query(query, [ping, id], (error, results, fields) => {
    if (error) {
      console.error("Error updating the ping value in the database:", error);
    } else {
      console.log(`The ping value for the record with id ${id} has been successfully updated in the database`);
    }
  });
}

app.get("/api/traceroute", async (req, res) => {
  try {
    connection.query(
      "SELECT * FROM resources",
      async (error, results, fields) => {
        if (error) {
          console.error("Error executing query:", error);
          return res.status(500).json({ error: "Error executing query" });
        }

        const traceroutePromises = results.map(async (resource) => {
          const { id, ip } = resource;
          try {
            const data = await performTraceroute(ip);
            await saveTracerouteResults(id, data);
          } catch (error) {
            console.error(`Error performing traceroute for IP ${ip}:`, error);
          }
        });

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

async function performTraceroute(ip) {
  return new Promise((resolve, reject) => {
    if (!ip || ip.trim() === "") {
      console.log("Empty IP detected. Skipping traceroute.");
      resolve([]); 
      return;
    }

    const tracer = new Traceroute();
    const hops = [];

    tracer
      .on("hop", (hop) => {
        if (hop.ip !== "") {
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

async function saveTracerouteResults(id, hops) {
  return new Promise((resolve, reject) => {
    const query = "UPDATE resources SET nodes = ? WHERE id = ?";
    connection.query(query, [hops.length, id], (error, results, fields) => {
      if (error) {
        console.error("Error updating the ping value in the database:", error);
        reject(error);
      } else {
        console.log(
          `The traceroute value for the record with id ${id} has been successfully updated in the database`
        );
        resolve(results);
      }
    });
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
