import { useMemo, useState } from "react";
import { useAdminData } from "../context/AdminDataContext";

const pickRandom = (items, count) => {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

export default function ExamGeneratorPage() {
  const { educations, normalUsers, examQuestions } = useAdminData();
  const [educationId, setEducationId] = useState("");
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState(null);

  const canGenerate = educationId && userId;

  const handleGenerate = () => {
    const questions = examQuestions.filter((item) => item.educationId === educationId);
    const easy = pickRandom(questions.filter((item) => item.difficulty === "easy"), 10);
    const medium = pickRandom(questions.filter((item) => item.difficulty === "medium"), 5);
    const hard = pickRandom(questions.filter((item) => item.difficulty === "hard"), 5);
    setResult([...easy, ...medium, ...hard]);
  };

  const counts = useMemo(
    () => ({
      easy: result?.filter((item) => item.difficulty === "easy").length ?? 0,
      medium: result?.filter((item) => item.difficulty === "medium").length ?? 0,
      hard: result?.filter((item) => item.difficulty === "hard").length ?? 0,
    }),
    [result],
  );

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h2>Sınav Oluşturucu</h2>
          <p>20 soru: 10 kolay + 5 orta + 5 zor dağılımıyla random seçim yapar.</p>
        </div>
      </div>

      <div className="admin-filter-grid">
        <label>
          <span>Eğitim</span>
          <select value={educationId} onChange={(event) => setEducationId(event.target.value)}>
            <option value="">Seçiniz</option>
            {educations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Kullanıcı</span>
          <select value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">Seçiniz</option>
            {normalUsers.slice(0, 40).map((item) => (
              <option key={item.id} value={item.id}>
                {item.firstName} {item.lastName}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" disabled={!canGenerate} onClick={handleGenerate}>
          Sınav Üret
        </button>
      </div>

      {result && (
        <article className="admin-panel-card">
          <h3>
            Soru Dağılımı: Kolay {counts.easy} / Orta {counts.medium} / Zor {counts.hard}
          </h3>
          <ul className="admin-activity-list">
            {result.map((question, index) => (
              <li key={`${question.id}-${index}`}>
                <strong>
                  {index + 1}. {question.questionText}
                </strong>
                <span>{question.difficulty.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
