import { motion } from "framer-motion";

type ProgressProps = {
  step: number; // 1 or 2
};

export default function StepProgress({ step }: ProgressProps) {
  return (
    <div className="w-full max-w-md mx-auto mb-2">
      {/* Progress Bar Track */}
      <div className="relative flex items-center">
        <div className="absolute top-1/2 left-0 w-full h-2 bg-gray-200 rounded-full -translate-y-1/2" />

        {/* Animated Fill */}
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: step === 1 ? "50%" : "100%" }}
          transition={{ duration: 0.5 }}
          className="absolute top-1/2 left-0 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full -translate-y-1/2"
        />

      </div>
    </div>
  );
}
