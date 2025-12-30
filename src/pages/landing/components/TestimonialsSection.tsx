import React, { useState, useEffect } from 'react';
import styles from './TestimonialsSection.module.css';
import landingStyles from '../LendingPage.module.css';
import { useLanguage } from '@/src/app/providers/useLanguage';

const TestimonialsSection: React.FC = () => {
  const { t } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [slidesPerView, setSlidesPerView] = useState(3);

  const testimonials = [
    { id: 1, name: 'Michael Chen', role: 'Professional Trader', initials: 'MC', color: '#667eea', rating: 5, text: t('landing.testimonial1') },
    { id: 2, name: 'Sarah Williams', role: 'Crypto Investor', initials: 'SW', color: '#764ba2', rating: 5, text: t('landing.testimonial2') },
    { id: 3, name: 'Alex Rodriguez', role: 'Arbitrage Specialist', initials: 'AR', color: '#10b981', rating: 5, text: t('landing.testimonial3') },
    { id: 4, name: 'Emma Thompson', role: 'Beginner Investor', initials: 'ET', color: '#3b82f6', rating: 5, text: t('landing.testimonial4') },
    { id: 5, name: 'David Kim', role: 'Crypto Enthusiast', initials: 'DK', color: '#f59e0b', rating: 5, text: t('landing.testimonial5') },
    { id: 6, name: 'Lisa Anderson', role: 'Full-time Trader', initials: 'LA', color: '#ef4444', rating: 5, text: t('landing.testimonial6') },
    { id: 7, name: 'James Miller', role: 'Investment Manager', initials: 'JM', color: '#8b5cf6', rating: 5, text: t('landing.testimonial7') },
    { id: 8, name: 'Sophie Martin', role: 'Finance Professional', initials: 'SM', color: '#ec4899', rating: 5, text: t('landing.testimonial8') },
    { id: 9, name: 'Robert Taylor', role: 'Hedge Fund Manager', initials: 'RT', color: '#14b8a6', rating: 5, text: t('landing.testimonial9') },
    { id: 10, name: 'Nina Patel', role: 'Tech Investor', initials: 'NP', color: '#6366f1', rating: 5, text: t('landing.testimonial10') },
    { id: 11, name: 'Carlos Garcia', role: 'Entrepreneur', initials: 'CG', color: '#f97316', rating: 5, text: t('landing.testimonial11') },
    { id: 12, name: 'Anna Kowalski', role: 'Software Engineer', initials: 'AK', color: '#06b6d4', rating: 5, text: t('landing.testimonial12') },
    { id: 13, name: 'Mohammed Al-Sayed', role: 'Business Owner', initials: 'MA', color: '#84cc16', rating: 5, text: t('landing.testimonial13') },
    { id: 14, name: 'Jessica Wong', role: 'Financial Analyst', initials: 'JW', color: '#a855f7', rating: 5, text: t('landing.testimonial14') },
    { id: 15, name: 'Thomas Mueller', role: 'Retired Investor', initials: 'TM', color: '#22c55e', rating: 5, text: t('landing.testimonial15') }
  ];

  const totalSlides = Math.ceil(testimonials.length / slidesPerView);

  // Handle responsive slides per view
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setSlidesPerView(1);
      } else if (window.innerWidth <= 1200) {
        setSlidesPerView(2);
      } else {
        setSlidesPerView(3);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset to first slide when slidesPerView changes
  useEffect(() => {
    setCurrentSlide(0);
  }, [slidesPerView]);

  useEffect(() => {
    if (!isPaused) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isPaused, totalSlides]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  return (
    <section 
      id="testimonials" 
      className={styles.testimonialsSection}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className={landingStyles.sectionContainer}>
        <h2 className={landingStyles.sectionTitleWhite}>{t('landing.testimonialsTitle')}</h2>
        <p className={landingStyles.sectionSubtitleWhite}>
          {t('landing.testimonialsSubtitle')}
        </p>
        
        <div className={styles.testimonialsSlider}>
          <button className={`${styles.sliderArrow} ${styles.left}`} onClick={prevSlide}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div className={styles.testimonialsWrapper}>
            <div 
              className={styles.testimonialsTrack}
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {Array.from({ length: totalSlides }).map((_, slideIndex) => (
                <div key={slideIndex} className={styles.testimonialsSlide}>
                  {testimonials
                    .slice(slideIndex * slidesPerView, (slideIndex + 1) * slidesPerView)
                    .map((testimonial) => (
                      <div key={testimonial.id} className={styles.testimonialCard}>
                        <div className={styles.testimonialHeader}>
                          <div className={styles.avatar} style={{ background: testimonial.color }}>
                            {testimonial.initials}
                          </div>
                          <div className={styles.userInfo}>
                            <h4 className={styles.userName}>{testimonial.name}</h4>
                            <p className={styles.userRole}>{testimonial.role}</p>
                          </div>
                        </div>
                        <div className={styles.rating}>
                          {Array.from({ length: testimonial.rating }).map((_, i) => (
                            <svg key={i} className={styles.star} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                          ))}
                        </div>
                        <p className={styles.testimonialText}>{testimonial.text}</p>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>

          <button className={`${styles.sliderArrow} ${styles.right}`} onClick={nextSlide}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        <div className={styles.sliderDots}>
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              className={`${styles.dot} ${currentSlide === index ? styles.active : ''}`}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
