import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { addTodo, deleteTodo, toggleTodo } from "./actions";
export default async function TodosPage() {
 const { user } = await requireSession();
 const todos = await prisma.todo.findMany({ where: { userId: user.id }, orderBy: [{ completed: "asc" }, { createdAt: "desc" }] });
 return <main><nav className="topbar"><Link className="brand" href="/dashboard">let&apos;s study</Link><div><Link href="/focus">Focus</Link><Link href="/subjects">Subjects</Link><Link href="/dashboard">Dashboard</Link></div></nav><section className="content"><p className="eyebrow">MAKE A LITTLE PROGRESS</p><h1>To-do list</h1><p className="muted">Keep track of the things you want to get done.</p><div className="study-card"><form action={addTodo} className="filter-row"><label>New task<input name="title" maxLength={200} required placeholder="What would you like to do?" /></label><button className="primary">Add task</button></form>{todos.length === 0 ? <p className="muted">No tasks yet. Add one to get started.</p> : todos.map(todo => <div key={todo.id} className="session-row"><form action={toggleTodo}><input type="hidden" name="id" value={todo.id} /><input type="hidden" name="completed" value={String(!todo.completed)} /><button className="text-button" aria-label={`${todo.completed ? "Mark incomplete" : "Mark complete"}: ${todo.title}`}>{todo.completed ? "☑" : "☐"} <span style={{ textDecoration: todo.completed ? "line-through" : "none" }}>{todo.title}</span></button></form><form action={deleteTodo}><input type="hidden" name="id" value={todo.id} /><button className="outline-button" aria-label={`Delete ${todo.title}`}>Delete</button></form></div>)}</div></section></main>;
}
