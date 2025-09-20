(() => {

  const STORAGE_KEY = 'daydream-tasks';
  const FILTER_KEY = 'daydream-tasks-filter';
  const VALID_FILTERS = new Set(['all', 'active', 'completed']);

  const form = document.getElementById('task-form');
  const taskInput = document.getElementById('task-input');
  const taskDate = document.getElementById('task-date');
  const formMessage = document.getElementById('form-message');
  const taskList = document.getElementById('task-list');
  const taskCounter = document.getElementById('task-counter');
  const emptyState = document.getElementById('empty-state');
  const emptyMessage = emptyState?.querySelector('p');
  const defaultEmptyText = emptyMessage?.textContent ?? '';
  const filterButtons = Array.from(document.querySelectorAll('.filter-button'));
  const clearButton = document.getElementById('clear-completed');

  if (!form || !taskInput || !taskList || !taskCounter || !clearButton || !taskDate) {
    return;
  }

  const storage = resolveStorage();

  let tasks = loadTasks();
  let currentFilter = loadFilter();

  setFilter(currentFilter, { render: false, persist: false });
  render();
  focusTaskInput();

  form.addEventListener('submit', handleSubmit);
  clearButton.addEventListener('click', () => {
    if (!tasks.some((task) => task.completed)) {
      return;
    }
    clearCompletedTasks();
  });

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setFilter(button.dataset.filter || 'all');
    });
  });

  function handleSubmit(event) {
    event.preventDefault();
    const title = taskInput.value.trim();
    const due = taskDate.value ? taskDate.value : null;

    if (!title) {
      showFormError('タスク名を入力してください。');
      return;
    }

    clearFormFeedback();
    addTask(title, due);
    form.reset();
    focusTaskInput();
  }

  function focusTaskInput() {
    if (typeof taskInput.focus !== 'function') {
      return;
    }

    try {
      taskInput.focus({ preventScroll: true });
    } catch (error) {
      taskInput.focus();
    }
  }

  function addTask(title, dueDate) {
    const task = {
      id: createId(),
      title,
      dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    tasks = [task, ...tasks];
    persistTasks();
    render();
  }

  function toggleTaskCompletion(taskId) {
    tasks = tasks.map((task) =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    persistTasks();
    render();
  }

  function deleteTask(taskId) {
    tasks = tasks.filter((task) => task.id !== taskId);
    persistTasks();
    render();
  }

  function clearCompletedTasks() {
    tasks = tasks.filter((task) => !task.completed);
    persistTasks();
    render();
  }

  function setFilter(filter, { render: shouldRender = true, persist = true } = {}) {
    const nextFilter = VALID_FILTERS.has(filter) ? filter : 'all';
    currentFilter = nextFilter;

    filterButtons.forEach((button) => {
      button.classList.toggle(
        'is-active',
        (button.dataset.filter || 'all') === nextFilter
      );
    });

    if (persist) {
      saveFilter(nextFilter);
    }

    if (shouldRender) {
      render();
    }
  }

  function render() {
    const filteredTasks = getFilteredTasks();

    taskList.innerHTML = '';
    filteredTasks.forEach((task) => {
      taskList.appendChild(createTaskElement(task));
    });

    const isEmpty = filteredTasks.length === 0;
    taskList.toggleAttribute('hidden', isEmpty);

    if (emptyState) {
      emptyState.hidden = !isEmpty;
      if (emptyMessage) {
        emptyMessage.textContent =
          tasks.length === 0
            ? defaultEmptyText
            : 'この表示ではタスクが見つかりません。条件を変えてみましょう。';
      }
    }

    updateCounter(filteredTasks.length);
    updateClearButton();
  }

  function createTaskElement(task) {
    const item = document.createElement('li');
    item.className = 'task-item';
    item.dataset.id = task.id;

    if (task.completed) {
      item.classList.add('is-completed');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `${task.title} の完了状態を切り替え`);
    checkbox.addEventListener('change', () => toggleTaskCompletion(task.id));

    const content = document.createElement('div');
    content.className = 'task-content';

    const title = document.createElement('p');
    title.className = 'task-title';
    title.textContent = task.title;

    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const dueInfo = formatDueDate(task.dueDate);
    if (dueInfo) {
      const dueBadge = document.createElement('span');
      dueBadge.className = 'task-date-badge';
      dueBadge.textContent = `期限 ${dueInfo.formatted}${
        dueInfo.relative ? `・${dueInfo.relative}` : ''
      }`;
      meta.appendChild(dueBadge);
    }

    const createdLabel = formatCreatedAt(task.createdAt);
    if (createdLabel) {
      const createdSpan = document.createElement('span');
      createdSpan.className = 'task-created';
      createdSpan.textContent = `登録 ${createdLabel}`;
      meta.appendChild(createdSpan);
    }

    content.appendChild(title);
    if (meta.childElementCount > 0) {
      content.appendChild(meta);
    }

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'task-action';
    deleteButton.setAttribute('aria-label', `${task.title} を削除`);
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✕';
    deleteButton.appendChild(icon);
    const srLabel = document.createElement('span');
    srLabel.className = 'sr-only';
    srLabel.textContent = '削除';
    deleteButton.appendChild(srLabel);
    deleteButton.addEventListener('click', () => deleteTask(task.id));

    item.appendChild(checkbox);
    item.appendChild(content);
    item.appendChild(deleteButton);

    return item;
  }

  function updateCounter(visibleCount) {
    const total = tasks.length;
    const active = tasks.filter((task) => !task.completed).length;
    const filterLabel =
      currentFilter === 'all'
        ? 'すべて'
        : currentFilter === 'active'
        ? '進行中'
        : '完了';

    taskCounter.textContent = `全${total}件・進行中${active}件（${filterLabel}: ${visibleCount}件表示）`;
  }

  function updateClearButton() {
    const hasCompleted = tasks.some((task) => task.completed);
    clearButton.disabled = !hasCompleted;
    clearButton.title = hasCompleted
      ? '完了済みのタスクを一括で整理します'
      : '完了済みのタスクがありません';
  }

  function getFilteredTasks() {
    if (currentFilter === 'active') {
      return tasks.filter((task) => !task.completed);
    }

    if (currentFilter === 'completed') {
      return tasks.filter((task) => task.completed);
    }

    return tasks;
  }

  function showFormError(message) {
    form.classList.add('has-error');
    if (formMessage) {
      formMessage.textContent = message;
    }
  }

  function clearFormFeedback() {
    form.classList.remove('has-error');
    if (formMessage) {
      formMessage.textContent = '';
    }
  }

  function loadTasks() {
    if (!storage) {
      return [];
    }

    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item) => typeof item === 'object' && item !== null)
        .map((item) => ({
          id: typeof item.id === 'string' && item.id ? item.id : createId(),
          title: typeof item.title === 'string' ? item.title : '名称未設定のタスク',
          completed: normaliseCompleted(item.completed),
          dueDate:
            typeof item.dueDate === 'string' && item.dueDate ? item.dueDate : null,
          createdAt:
            typeof item.createdAt === 'string' && item.createdAt
              ? item.createdAt
              : new Date().toISOString(),
        }));
    } catch (error) {
      console.warn('タスクの読み込みに失敗しました。', error);
      return [];
    }
  }

  function persistTasks() {
    if (!storage) {
      return;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.warn('タスクの保存に失敗しました。', error);
    }
  }

  function loadFilter() {
    if (!storage) {
      return 'all';
    }

    try {
      const stored = storage.getItem(FILTER_KEY);
      return VALID_FILTERS.has(stored) ? stored : 'all';
    } catch (error) {
      console.warn('フィルターの読み込みに失敗しました。', error);
      return 'all';
    }
  }

  function saveFilter(filter) {
    if (!storage) {
      return;
    }

    try {
      storage.setItem(FILTER_KEY, filter);
    } catch (error) {
      console.warn('フィルターの保存に失敗しました。', error);
    }
  }

  function formatDueDate(dateString) {
    if (!dateString) {
      return null;
    }

    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const formatter = new Intl.DateTimeFormat('ja-JP', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });

    const formatted = formatter.format(date);
    const relative = describeRelativeDay(date);

    return { formatted, relative };
  }

  function describeRelativeDay(date) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const startOf = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

    const today = startOf(new Date());
    const target = startOf(date);
    const diffDays = Math.round((target - today) / msPerDay);

    if (diffDays === 0) {
      return '今日';
    }

    if (diffDays === 1) {
      return '明日';
    }

    if (diffDays === -1) {
      return '昨日';
    }

    if (diffDays > 1 && diffDays <= 7) {
      return `${diffDays}日後`;
    }

    if (diffDays < -1 && diffDays >= -7) {
      return `${Math.abs(diffDays)}日前`;
    }

    return '';
  }

  function formatCreatedAt(dateString) {
    if (!dateString) {
      return '';
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function normaliseCompleted(value) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalised = value.trim().toLowerCase();
      if (normalised === 'true' || normalised === '1' || normalised === 'yes') {
        return true;
      }
      if (
        normalised === 'false' ||
        normalised === '0' ||
        normalised === 'no' ||
        normalised === ''
      ) {
        return false;
      }
    }

    if (typeof value === 'number') {
      if (Number.isNaN(value)) {
        return false;
      }
      return value !== 0;
    }

    return Boolean(value);
  }

  function createId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function resolveStorage() {
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      return null;
    }

    try {
      const testKey = '__daydream-storage-test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch (error) {
      console.warn('ローカルストレージが利用できません。', error);
      return null;
    }
  }
})();
