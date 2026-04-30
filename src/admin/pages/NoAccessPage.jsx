export default function NoAccessPage() {
  return (
    <section className="admin-empty-state admin-no-access">
      <i className="fa-solid fa-ban" />
      <h2>Bu alana erişim yetkiniz yok.</h2>
      <p>Menüler görünmeye devam eder, ancak bu modül için rol izniniz aktif değil.</p>
    </section>
  );
}
