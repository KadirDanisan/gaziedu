import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { userApi } from "../api/userApi";
import { useAuth } from "../context/AuthContext";

const PENDING_POLL_INTERVAL_MS = 3000;
const PENDING_POLL_LIMIT = 5;

const formatMoneyTry = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(num);
};

const VIEW = {
  paid: {
    icon: "fa-solid fa-circle-check",
    iconStyle: { background: "#ecfdf5", color: "#15803d" },
    title: "Ödemeniz alındı",
    text: "Başvurunuz ve ödemeniz kaydedildi. Belge kontrolü ve onayın ardından eğitim müfredatına bu hesapla erişebilirsiniz.",
  },
  failed: {
    icon: "fa-solid fa-circle-xmark",
    iconStyle: { background: "#fef2f2", color: "#b91c1c" },
    title: "Ödeme tamamlanamadı",
    text: "Kartınızdan tahsilat yapılmadı. Başvuru bilgileriniz kayıtlı; ödemeyi tekrar deneyebilirsiniz.",
  },
  pending: {
    icon: "fa-solid fa-hourglass-half",
    iconStyle: { background: "#fffbeb", color: "#b45309" },
    title: "Ödeme sonucu bekleniyor",
    text: "Bankadan kesin sonuç henüz gelmedi. Kartınızdan çekim yapıldıysa ödemeniz kontrol edilerek başvurunuza işlenecektir; lütfen tekrar ödeme yapmayın.",
  },
  review: {
    icon: "fa-solid fa-magnifying-glass",
    iconStyle: { background: "#fffbeb", color: "#b45309" },
    title: "Ödemeniz inceleniyor",
    text: "Ödeme kaydınızda bir uyuşmazlık tespit edildi ve manuel incelemeye alındı. Lütfen tekrar ödeme yapmayın; sizinle iletişime geçilecektir.",
  },
};

function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { isLoggedIn, isReady } = useAuth();
  const paymentId = searchParams.get("paymentId") || "";
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return undefined;
    if (!paymentId) {
      setLoading(false);
      setError(
        searchParams.get("reason") === "error"
          ? "Ödeme sonucu işlenirken bir hata oluştu. Kartınızdan çekim yapıldıysa lütfen bizimle iletişime geçin."
          : "Ödeme kaydı bulunamadı.",
      );
      return undefined;
    }
    if (!isLoggedIn) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let timer = null;
    let attempts = 0;

    const load = async () => {
      attempts += 1;
      try {
        const data = await userApi.getPaymentStatus(paymentId);
        if (cancelled) return;
        setPayment(data);
        setError("");
        if (data?.status === "pending" && attempts < PENDING_POLL_LIMIT) {
          timer = window.setTimeout(load, PENDING_POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Ödeme durumu alınamadı.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [isReady, isLoggedIn, paymentId, searchParams]);

  const view = payment ? VIEW[payment.status] || VIEW.pending : null;
  const coursePath = payment?.educationSlug ? `/egitim-detay/${payment.educationSlug}` : "/tum-egitimler";

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="paid-apply-result" style={{ padding: "48px 16px" }}>
          {loading ? <p>Ödeme durumu kontrol ediliyor…</p> : null}

          {!loading && isReady && !isLoggedIn && paymentId ? (
            <>
              <h3>Ödeme sonucunu görmek için giriş yapın</h3>
              <p>Ödemeyi başlattığınız hesapla giriş yaptıktan sonra sonuç bu sayfada gösterilir.</p>
              <p style={{ marginTop: 16 }}>
                <Link className="btn" to={`/kullanici-islemleri?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>
                  Giriş yap
                </Link>
              </p>
            </>
          ) : null}

          {!loading && error ? (
            <>
              <div className="paid-apply-result__icon" style={VIEW.failed.iconStyle} aria-hidden>
                <i className="fa-solid fa-triangle-exclamation" />
              </div>
              <p>{error}</p>
              <p style={{ marginTop: 16 }}>
                <Link className="btn btn-outline" to="/tum-egitimler">
                  Eğitimlere dön
                </Link>
              </p>
            </>
          ) : null}

          {!loading && !error && view ? (
            <>
              <div className="paid-apply-result__icon" style={view.iconStyle} aria-hidden>
                <i className={view.icon} />
              </div>
              <h3>{view.title}</h3>
              <p>{view.text}</p>
              <p className="paid-apply-result__muted">
                {payment.educationName ? `${payment.educationName} · ` : ""}
                {formatMoneyTry(payment.amount)}
              </p>
              {payment.status === "failed" && payment.errorMessage ? (
                <p className="paid-apply-result__muted">Banka mesajı: {payment.errorMessage}</p>
              ) : null}
              <p style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {payment.status === "failed" && payment.educationSlug ? (
                  <Link className="btn" to={`${coursePath}?basvuru=1`}>
                    Ödemeyi tekrar dene
                  </Link>
                ) : null}
                <Link className={payment.status === "failed" ? "btn btn-outline" : "btn"} to={coursePath}>
                  Eğitim sayfasına dön
                </Link>
              </p>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default PaymentResultPage;
