import React, { useEffect, useState } from 'react';
import './Dice.css';

const Dice = ({ die1, die2, onComplete }) => {
  const [rolling, setRolling] = useState(true);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    // Start rolling animation
    const timer = setTimeout(() => {
      setRolling(false);
      setShowResult(true);

      // Cleanup after showing result
      setTimeout(() => {
        onComplete();
      }, 1500); // Show result for 1.5s
    }, 1000); // Roll for 1s

    return () => clearTimeout(timer);
  }, []);

  // Map numbers to rotation classes
  const getSideClass = (num) => `show-${num}`;

  return (
    <div className="dice-overlay">
       <div className="dice-container">
          <div className={`die ${rolling ? 'rolling' : getSideClass(die1)}`}>
             <div className="side one">
               <div className="dot center"></div>
             </div>
             <div className="side two">
               <div className="dot top-left"></div>
               <div className="dot bottom-right"></div>
             </div>
             <div className="side three">
               <div className="dot top-left"></div>
               <div className="dot center"></div>
               <div className="dot bottom-right"></div>
             </div>
             <div className="side four">
               <div className="dot top-left"></div>
               <div className="dot top-right"></div>
               <div className="dot bottom-left"></div>
               <div className="dot bottom-right"></div>
             </div>
             <div className="side five">
               <div className="dot top-left"></div>
               <div className="dot top-right"></div>
               <div className="dot center"></div>
               <div className="dot bottom-left"></div>
               <div className="dot bottom-right"></div>
             </div>
             <div className="side six">
               <div className="dot top-left"></div>
               <div className="dot top-right"></div>
               <div className="dot mid-left"></div>
               <div className="dot mid-right"></div>
               <div className="dot bottom-left"></div>
               <div className="dot bottom-right"></div>
             </div>
          </div>

          <div className={`die ${rolling ? 'rolling-2' : getSideClass(die2)}`}>
             <div className="side one">
               <div className="dot center"></div>
             </div>
             <div className="side two">
               <div className="dot top-left"></div>
               <div className="dot bottom-right"></div>
             </div>
             <div className="side three">
               <div className="dot top-left"></div>
               <div className="dot center"></div>
               <div className="dot bottom-right"></div>
             </div>
             <div className="side four">
               <div className="dot top-left"></div>
               <div className="dot top-right"></div>
               <div className="dot bottom-left"></div>
               <div className="dot bottom-right"></div>
             </div>
             <div className="side five">
               <div className="dot top-left"></div>
               <div className="dot top-right"></div>
               <div className="dot center"></div>
               <div className="dot bottom-left"></div>
               <div className="dot bottom-right"></div>
             </div>
             <div className="side six">
               <div className="dot top-left"></div>
               <div className="dot top-right"></div>
               <div className="dot mid-left"></div>
               <div className="dot mid-right"></div>
               <div className="dot bottom-left"></div>
               <div className="dot bottom-right"></div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default Dice;
