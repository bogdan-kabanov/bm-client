import React, { useEffect, useRef, useState } from 'react';
import styles from './StatsSection.module.css';
import landingStyles from '../LendingPage.module.css';

const StatsSection: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const stats = [
    {
      id: 1,
      value: 20,
      suffix: '*',
      title: 'Minimum investment amount',
    //   description: 'Start trading with small amounts'
    },
    {
      id: 2,
      value: 1,
      suffix: '$',
      title: 'Minimum trade amount',
    //   description: 'Low entry threshold'
    },
    {
      id: 3,
      value: 50000,
      suffix: '+',
      title: 'Algorithms engaged per minute',
    //   description: 'Practice risk-free'
    },
    {
      id: 4,
      value: 50,
      suffix: '+',
      title: 'Trading pairs',
    //   description: 'Various deposit options'
    },
    {
      id: 5,
      value: 0,
      suffix: '$',
      title: 'No commission on deposit and withdrawal',
    //   description: 'Keep all your profits'
    },
    {
      id: 6,
      value: 100,
      suffix: '+',
      title: 'Assets for trading',
    //   description: 'Wide selection of instruments'
    }
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className={styles.statsSection}>
      <div className={landingStyles.sectionContainer}>
        <div className={styles.statsGrid}>
          {stats.map((stat, index) => (
            <div key={stat.id} className={styles.statCard}>
              <div className={styles.statValue}>
                <AnimatedNumber 
                  value={stat.value} 
                  isVisible={isVisible}
                  delay={index * 200}
                />
                <span className={styles.statSuffix}>{stat.suffix}</span>
              </div>
              <h3 className={styles.statTitle}>{stat.title}</h3>
              {/* <p className={styles.statDescription}>{stat.description}</p> */}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Компонент для анимированных чисел
interface AnimatedNumberProps {
  value: number;
  isVisible: boolean;
  delay: number;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, isVisible, delay }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (isVisible && !hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
        
        const startTime = Date.now();
        const duration = 2000;
        const startValue = 0;
        
        const animate = () => {
          const currentTime = Date.now();
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // easing function
          const easeOutQuart = 1 - Math.pow(1 - progress, 4);
          const currentValue = Math.floor(startValue + (value - startValue) * easeOutQuart);
          
          setDisplayValue(currentValue);
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };
        
        animate();
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [isVisible, hasAnimated, value, delay]);

  // Форматирование чисел с разделителями
  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return num.toLocaleString();
    }
    return num.toString();
  };

  return <span className={styles.animatedNumber}>{formatNumber(displayValue)}</span>;
};

export default StatsSection;