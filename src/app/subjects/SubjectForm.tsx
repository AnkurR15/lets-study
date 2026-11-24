"use client";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSubject } from "./actions";

const colors = [
  { name: "Sage", value: "#719775" }, { name: "Forest", value: "#3f755a" },
  { name: "Ocean", value: "#5b8da1" }, { name: "Lavender", value: "#9382b1" },
  { name: "Rose", value: "#c77e86" }, { name: "Peach", value: "#d6916d" },
  { name: "Honey", value: "#c7a258" }, { name: "Slate", value: "#758b8a" },
];
type Subject = { id: string; name: string; description: string | null; color: string };
export function SubjectForm({ subject }: { subject?: Subject }) {
  const [color, setColor] = useState(subject?.color ?? colors[0].value);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  function submit(data: FormData) {
    startTransition(async () => {
      try {
        await saveSubject(data);
        toast.success(subject ? "Subject updated" : "Subject created");
        if (!subject) { formRef.current?.reset(); setColor(colors[0].value); }
      } catch { toast.error("Could not save the subject. Check your details and try again."); }
    });
  }
  return <form ref={formRef} action={submit} className="form subject-form">
    {subject && <input type="hidden" name="id" value={subject.id} />}
    <label>Name<input name="name" required maxLength={100} defaultValue={subject?.name} placeholder="e.g. Mathematics" /></label>
    <fieldset className="color-field"><legend>Subject color</legend><div className="color-swatches">{colors.map(item => <button key={item.value} type="button" className={`color-swatch ${color.toLowerCase() === item.value ? "is-selected" : ""}`} style={{ backgroundColor: item.value }} onClick={() => setColor(item.value)} aria-label={item.name} aria-pressed={color.toLowerCase() === item.value} title={item.name} />)}<label className="custom-color" title="Choose a custom color">Custom<input aria-label="Choose a custom color" type="color" value={color} onChange={event => setColor(event.target.value)} /></label></div><input type="hidden" name="color" value={color} /></fieldset>
    <label>Description <span className="field-hint">Optional</span><textarea name="description" maxLength={500} rows={3} defaultValue={subject?.description ?? ""} placeholder="What are you studying?" /></label>
    <button className="primary" disabled={pending}>{pending ? "Saving…" : subject ? "Save changes" : "Add subject"}</button>
  </form>;
}
