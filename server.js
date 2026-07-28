const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = __dirname;
const MONDAY_API_URL = "https://api.monday.com/v2";
const LIVENET_WORKSPACE_ID = "9452673";
const LIVENET_WORKSPACE_NAME = "LiveNet";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function queryMonday(query, variables = {}) {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    const error = new Error("MONDAY_API_TOKEN is missing");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    const parseError = new Error("monday returned a non-JSON response");
    parseError.statusCode = 502;
    throw parseError;
  }

  if (!response.ok || payload.errors) {
    const apiError = new Error("monday API request failed");
    apiError.statusCode = response.ok ? 502 : response.status;
    apiError.details = payload.errors || payload;
    throw apiError;
  }

  return payload.data;
}

const boardFields = `
  id
  name
  state
  board_kind
  updated_at
  description
  columns { id title type settings_str }
  groups { id title color position }
  items_page(limit: 100) {
    cursor
    items {
      id
      name
      group { id title }
      created_at
      updated_at
      column_values { id type text value column { id title type } }
    }
  }
`;

const itemPageFields = `
  cursor
  items {
    id
    name
    group { id title }
    created_at
    updated_at
    column_values { id type text value column { id title type } }
  }
`;

async function fetchAllItems(firstPage) {
  const items = [...firstPage.items];
  let cursor = firstPage.cursor;

  while (cursor) {
    const data = await queryMonday(`query ($cursor: String!) { next_items_page(cursor: $cursor, limit: 100) { ${itemPageFields} } }`, {
      cursor
    });
    items.push(...data.next_items_page.items);
    cursor = data.next_items_page.cursor;
  }

  return items;
}

async function fetchLiveNetWorkspace() {
  const data = await queryMonday(`query ($workspaceIds: [ID!]) { boards(workspace_ids: $workspaceIds, limit: 100) { ${boardFields} } }`, {
    workspaceIds: [LIVENET_WORKSPACE_ID]
  });

  const boards = [];
  for (const board of data.boards) {
    boards.push({
      ...board,
      items: await fetchAllItems(board.items_page),
      items_page: undefined
    });
  }

  return {
    workspace: {
      id: LIVENET_WORKSPACE_ID,
      name: LIVENET_WORKSPACE_NAME
    },
    boards
  };
}

async function handleApi(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    if (request.url === "/api/monday/me") {
      const data = await queryMonday("query { me { id name email } }");
      sendJson(response, 200, { user: data.me });
      return;
    }

    if (request.url === "/api/monday/boards") {
      const data = await queryMonday("query { boards(limit: 25) { id name state board_kind updated_at } }");
      sendJson(response, 200, { boards: data.boards });
      return;
    }

    if (request.url === "/api/monday/workspaces/livenet") {
      const data = await fetchLiveNetWorkspace();
      sendJson(response, 200, data);
      return;
    }

    sendJson(response, 404, { error: "API route not found" });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    sendJson(response, statusCode, {
      error: error.message,
      details: error.details
    });
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(contents);
  });
}

loadEnvFile(path.join(__dirname, ".env.local"));
loadEnvFile(path.join(__dirname, ".env"));

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/api/")) {
    handleApi(request, response);
    return;
  }

  serveStatic(request, response);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Workroom running at http://127.0.0.1:${PORT}/`);
});
