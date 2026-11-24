"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Subject = { id: string; name: string; archived: boolean };
export function HistoryFilters({ initialDate, initialSubject, subjects }: { initialDate: string; initialSubject: string; subjects: Subject[] }) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [subject, setSubject] = useState(initialSubject);
  return <form className="filter-row" action="/history">
    <label>Date<input type="date" name="date" value={date} onChange={event => setDate(event.target.value)} /></label>
    <label>Subject<select name="subject" value={subject} onChange={event => setSubject(event.target.value)}><option value="">All subjects</option>{subjects.map(item => <option key={item.id} value={item.id}>{item.name}{item.archived ? " (archived)" : ""}</option>)}</select></label>
    <button className="primary">Filter</button>
    <button type="button" className="outline-button clear-filters" onClick={() => { setDate(""); setSubject(""); router.push("/history"); }}>Clear filters</button>
  </form>;
}
