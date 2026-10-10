async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const responseText = response.status === 204 ? '' : await response.text();
  let result = null;
  if (responseText.trim()) {
    try {
      result = JSON.parse(responseText);
    } catch {
      if (response.ok) {
        throw new Error('The server returned an invalid response. Check the backend logs.');
      }
    }
  } else if (response.ok && response.status !== 204) {
    throw new Error('The server returned an empty response. Check the backend and database connection.');
  }

  if (!response.ok) {
    throw new Error(result?.error || `The server could not complete the request (HTTP ${response.status}).`);
  }
  return result;
}

export const api = {
  session: () => request('/auth/session'),
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  register: (user) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(user),
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  listTasks: () => request('/tasks'),
  createTask: (text) =>
    request('/tasks', { method: 'POST', body: JSON.stringify({ text }) }),
  updateTask: (id, completed) =>
    request(`/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),
  deleteTask: (id) =>
    request(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  clearCompletedTasks: () =>
    request('/tasks/completed', { method: 'DELETE' }),
};
