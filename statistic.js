// statistics.js
class WorkoutStatistics {
    constructor(db) {
        this.db = db;
    }

    async loadStatistics(timeframe) {
        const startDate = this.getStartDate(timeframe);
        try {
            const logsRef = collection(this.db, 'workoutLogs');
            const q = query(
                logsRef,
                where('timestamp', '>=', startDate),
                orderBy('timestamp', 'desc')
            );
            
            const querySnapshot = await getDocs(q);
            const logs = [];
            querySnapshot.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
            
            return this.processStatistics(logs, timeframe);
        } catch (error) {
            console.error('Error loading statistics:', error);
            throw error;
        }
    }

    getStartDate(timeframe) {
        const now = new Date();
        switch (timeframe) {
            case 'daily':
                return new Date(now.setHours(0, 0, 0, 0));
            case 'weekly':
                return new Date(now.setDate(now.getDate() - 7));
            case 'monthly':
                return new Date(now.setMonth(now.getMonth() - 1));
            case 'all':
                return new Date(0); // Beginning of time
            default:
                return new Date(now.setHours(0, 0, 0, 0));
        }
    }

    processStatistics(logs, timeframe) {
        const stats = {
            totalWorkouts: logs.length,
            totalTime: 0,
            totalRestTime: 0,
            exerciseStats: {},
            dailyStats: {},
            averageWorkoutDuration: 0,
            bestWorkout: null,
            mostFrequentExercise: null
        };

        logs.forEach(log => {
            // Aggregate total times
            stats.totalTime += log.totalDuration;
            stats.totalRestTime += log.totalRestTime;

            // Process exercise-specific stats
            log.exercises.forEach(exercise => {
                if (!stats.exerciseStats[exercise.name]) {
                    stats.exerciseStats[exercise.name] = {
                        totalSets: 0,
                        totalDuration: 0,
                        averageSetDuration: 0
                    };
                }
                const exerciseStat = stats.exerciseStats[exercise.name];
                exerciseStat.totalSets++;
                exerciseStat.totalDuration += exercise.duration;
            });

            // Daily stats
            const dateKey = new Date(log.timestamp.toDate()).toLocaleDateString();
            if (!stats.dailyStats[dateKey]) {
                stats.dailyStats[dateKey] = {
                    workouts: 0,
                    totalDuration: 0
                };
            }
            stats.dailyStats[dateKey].workouts++;
            stats.dailyStats[dateKey].totalDuration += log.totalDuration;
        });

        // Calculate averages and find best performances
        if (logs.length > 0) {
            stats.averageWorkoutDuration = stats.totalTime / logs.length;
            
            // Calculate average set duration for each exercise
            Object.values(stats.exerciseStats).forEach(exerciseStat => {
                exerciseStat.averageSetDuration = 
                    exerciseStat.totalDuration / exerciseStat.totalSets;
            });

            // Find most frequent exercise
            stats.mostFrequentExercise = Object.entries(stats.exerciseStats)
                .sort((a, b) => b[1].totalSets - a[1].totalSets)[0];

            // Find best workout (longest duration)
            stats.bestWorkout = logs.reduce((best, current) => 
                !best || current.totalDuration > best.totalDuration ? current : best
            );
        }

        return stats;
    }

    renderStatistics(stats, timeframe) {
        return `
            <div class="statistics-container">
                <h2>${this.capitalizeFirst(timeframe)} Statistics</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>Overview</h3>
                        <p>Total Workouts: ${stats.totalWorkouts}</p>
                        <p>Total Time: ${this.formatDuration(stats.totalTime)}</p>
                        <p>Average Workout: ${this.formatDuration(stats.averageWorkoutDuration)}</p>
                    </div>

                    <div class="stat-card">
                        <h3>Best Performance</h3>
                        ${stats.bestWorkout ? `
                            <p>Date: ${new Date(stats.bestWorkout.timestamp.toDate()).toLocaleDateString()}</p>
                            <p>Duration: ${this.formatDuration(stats.bestWorkout.totalDuration)}</p>
                        ` : '<p>No workouts recorded</p>'}
                    </div>

                    <div class="stat-card">
                        <h3>Exercise Analysis</h3>
                        ${stats.mostFrequentExercise ? `
                            <p>Most Frequent: ${stats.mostFrequentExercise[0]}</p>
                            <p>Total Sets: ${stats.mostFrequentExercise[1].totalSets}</p>
                        ` : '<p>No exercises recorded</p>'}
                    </div>
                </div>

                <div class="workout-history">
                    <h3>Daily Breakdown</h3>
                    ${this.renderDailyStats(stats.dailyStats)}
                </div>

                <div class="exercise-details">
                    <h3>Exercise Details</h3>
                    ${this.renderExerciseStats(stats.exerciseStats)}
                </div>
            </div>
        `;
    }

    renderDailyStats(dailyStats) {
        return `
            <div class="daily-stats-grid">
                ${Object.entries(dailyStats).map(([date, stats]) => `
                    <div class="daily-stat-card">
                        <h4>${date}</h4>
                        <p>Workouts: ${stats.workouts}</p>
                        <p>Total Time: ${this.formatDuration(stats.totalDuration)}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderExerciseStats(exerciseStats) {
        return `
            <div class="exercise-stats-grid">
                ${Object.entries(exerciseStats).map(([exercise, stats]) => `
                    <div class="exercise-stat-card">
                        <h4>${exercise}</h4>
                        <p>Total Sets: ${stats.totalSets}</p>
                        <p>Average Set: ${this.formatDuration(stats.averageSetDuration)}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    capitalizeFirst(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        const remainingSeconds = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
        }
        return `${minutes}m ${remainingSeconds}s`;
    }
}
