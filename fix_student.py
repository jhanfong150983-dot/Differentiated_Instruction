from pathlib import Path
path = Path("student.js")
text = path.read_text(encoding="utf-8")
old_dup = "                console.log('?? [Debug] 學習記錄:', learningRecord);\n                \n                                console.log('?? [Debug] 學習記錄:', learningRecord);"
if old_dup in text:
    text = text.replace(old_dup, "                console.log('?? [Debug] 學習記錄:', learningRecord);")
old_map = "courseTiers.map(t => ${t.tierId} ())"
if old_map in text:
    text = text.replace(old_map, "courseTiers.map(t => `${t.tierId} (${t.name})`)")
path.write_text(text, encoding="utf-8")
