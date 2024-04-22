import React, { useState, useEffect, useCallback } from "react";
import { DataGrid, GridActionsCellItem, GridToolbarContainer } from "@mui/x-data-grid";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import NotInterestedIcon from '@mui/icons-material/NotInterested';
import EditIcon from "@mui/icons-material/Edit";
import AdjustIcon from '@mui/icons-material/Adjust';
import RouteIcon from '@mui/icons-material/Route';
import AddIcon from "@mui/icons-material/Add";
import { Button, Box } from "@mui/material";
import Loader from "./Loader";

export default function Table() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/getData');
      if (!response.ok) {
        throw new Error('Ошибка при получении данных');
      }
      const jsonData = await response.json();
      setData(jsonData);
    } catch (error) {
      console.error('Ошибка при получении данных:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addHandler = useCallback(() => {
    setLoading(true);

    fetch('http://localhost:3001/addData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'Новое имя', ip: 'Новое ip' })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Ошибка при добавлении данных');
        }
        return response.json();
      })
      .then(data => {
        console.log('Данные успешно добавлены:', data);
        fetchData();
      })
      .catch(error => {
        console.error('Ошибка при добавлении данных:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchData]);

  const clearHandler = useCallback(() => {
    setLoading(true);

    fetch(`http://localhost:3001/clearData`, {
      method: 'DELETE',
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Ошибка при очистке данных');
        }
        console.log('Данные успешно удалены');
        fetchData();
      })
      .catch(error => {
        console.error('Ошибка при очистке данных:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchData]);

  const deleteHandler = useCallback((id) => {
    setLoading(true);

    fetch(`http://localhost:3001/deleteData/${id}`, {
      method: 'DELETE',
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Ошибка при удалении данных');
        }
        console.log('Данные успешно удалены');
        fetchData();
      })
      .catch(error => {
        console.error('Ошибка при удалении данных:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchData]);

  const editHandler = useCallback((updatedData) => {
    setLoading(true);

    fetch(`http://localhost:3001/editData/${updatedData.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedData)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Ошибка при редактировании данных');
        }
        console.log('Данные успешно отредактированы');
        fetchData();
      })
      .catch(error => {
        console.error('Ошибка при редактировании данных:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchData]);

  const pingHandler = useCallback(() => {
    setLoading(true);

    fetch('http://localhost:3001/api/ping', {
      method: 'GET',
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Ошибка при обновлении данных');
        }
        console.log('Данные успешно обновлены');
        fetchData();
      })
      .catch(error => {
        console.error('Ошибка при обновлении данных:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchData]);

  const tracerouteHandler = useCallback(() => {
    setLoading(true);

    fetch('http://localhost:3001/api/traceroute')
      .then(response => {
        if (!response.ok) {
          throw new Error('Ошибка при выполнении traceroute');
        }
        console.log('Traceroute успешно выполнен');
        fetchData();
      })
      .catch(error => {
        console.error('Ошибка при выполнении traceroute:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchData]);

  const columns = [
    { field: "index", headerName: "№", width: 20 },
    {
      field: "actions",
      type: "actions",
      getActions: (params) => [
        <GridActionsCellItem
          icon={<DeleteOutlineIcon />}
          onClick={() => {
            deleteHandler(params.row.id)
          }}
          label="Удалить"
        />,
        <GridActionsCellItem
          icon={<EditIcon />}
          onClick={() => {
            editHandler(params.row);
          }}
          label="Редактировать"
        />,
      ],
    },
    { field: "ID", headerName: "ID", width: 150 },
    { field: "name", headerName: "name", width: 300, editable: true },
    { field: "ip", headerName: "ip", width: 400, editable: true },
    { field: "ping", headerName: "ping", width: 400 },
    { field: "nodes", headerName: "nodes", width: 400 },
  ];

  const customToolbar = useCallback(
    () => (
      <GridToolbarContainer>
        <Box>
          <Button
            startIcon={<AddIcon />}
            onClick={addHandler}
          >
            Добавить
          </Button>
          <Button
            startIcon={<NotInterestedIcon />}
            onClick={clearHandler}
          >
            Очистить
          </Button>
          <Button
            startIcon={<AdjustIcon />}
            onClick={pingHandler}
          >
            PING
          </Button>
          <Button
            startIcon={<RouteIcon />}
            onClick={tracerouteHandler}
          >
            TRACEROUTE
          </Button>
        </Box>
      </GridToolbarContainer>
    ),
    [addHandler, clearHandler, pingHandler, tracerouteHandler]
  );

  const customFooter = useCallback((props) => {
    return (
      <Box
        sx={{ p: 1, display: "flex", borderTop: 1, borderColor: "grey.300" }}
      >
        Всего {props.rowCount}
      </Box>
    );
  }, []);

  return (
    <>
      {loading && <Loader />}
      <div className="table">
        <DataGrid
          rows={data}
          columns={columns}
          slots={{
            toolbar: customToolbar,
            footer: customFooter,
          }}
          slotProps={{
            footer: { rowCount: data.length },
          }}
        />
      </div>
    </>
  );
}
