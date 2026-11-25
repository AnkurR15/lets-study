"use client";
import { useState, useTransition, type FormEvent } from "react";
import { addTodo } from "./actions";
export function TodoForm() {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      try { const result = await addTodo(data); setError(result.error); if (!result.error) form.reset(); }
      catch { setError("Could not add the task. Please try again."); }
    });
  }
  return <form onSubmit={submit} className="filter-row"><label>New task<input name="title" maxLength={200} required placeholder="What would you like to do?" aria-invalid={!!error} aria-describedby={error ? "todo-error" : undefined} />{error && <span id="todo-error" className="error" role="alert">{error}</span>}</label><button className="primary" disabled={pending}>Add task</button></form>;
}
