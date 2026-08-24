import { Link } from "react-router-dom";
import Hero from "../components/Hero";
import UpcomingCourses from "../components/UpcomingCourses";
import FollowerCourses from "../components/followerCourses";
import AboutMediaCarousel from "../components/AboutMediaCarousel";
import FaqContact from "../components/FaqContact";
import Partners from "../components/Partners";
import NewsletterSection from "../components/NewsletterSection";

const ABOUT_VALUES = [
  "Yenilikçilik",
  "Şeffaflık",
  "Erişilebilirlik",
  "Güvenirlik",
  "Kapsayıcılık",
  "Esneklik",
];

function HomePage() {
  return (
    <>
      <Hero />
      <FollowerCourses />
 
      <UpcomingCourses />
      <FaqContact />
      <Partners />
      <NewsletterSection />
    </>
  );
}

export default HomePage;
