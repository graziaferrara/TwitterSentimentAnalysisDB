var fs = require('fs');

/*
    1. AVERAGE SENTIMENT PER TREND
    For each trend, select all the tweets associated with the trend and show the
    sentiment obtained as the average of the sentiment of the selected tweets.
*/

/**
 * The function operation1 retrieves trends from a database, performs aggregation and lookup operations
 * on the associated tweets, and returns the average sentiment for each trend.
 * @param db - The "db" parameter is a reference to a database object. It is used to interact with the
 * database and perform operations such as querying and aggregating data. In this code snippet, the
 * "db" object is used to access collections and perform aggregation operations on them.
 * @returns an array of objects that contain the name, location, date, and sentiment of each trend in
 * the database.
 */
function operation1(db) {

    trends = db.getCollection('Trends').find({});

    results = [];

    trends.forEach(function (trend) {

        result = db.getCollection('Trends').aggregate([
            {
                $match: {
                    name: trend.name,
                    location: trend.location,
                    date: trend.date
                }
            }, {
                $unwind: {
                    path: '$tweets'
                }
            }, {
                $lookup: {
                    from: 'Tweets',
                    localField: 'tweets',
                    foreignField: '_id',
                    as: 'tweetsData'
                }
            }, {
                $unwind: {
                    path: '$tweetsData'
                }
            }, {
                $group: {
                    _id: {
                        name: '$name',
                        location: '$location',
                        date: '$date'
                    },
                    sentiment: {
                        $avg: '$tweetsData.sentiment'
                    }
                }
            }, {
                $project: {
                    _id: 0,
                    name: '$_id.name',
                    location: '$_id.location',
                    date: '$_id.date',
                    sentiment: 1
                }
            }
        ]);

        results.push(result.toArray()[0]);

    });

    return results;

}

/* 
    2. SENTIMENT PERCENTAGES
    For each trend, select all the tweets that belong to it and for each value of sentiment that the tweet can assume,
    print the percentage of them that obtained that particular sentiment.
 */

/**
 * The function `operation2` retrieves data from a MongoDB database and performs aggregation operations
 * to calculate the percentage of positive, neutral, and negative tweets for each trend.
 * @param db - The "db" parameter is an object representing a database. It is used to perform
 * operations on the database, such as querying collections and aggregating data.
 * @returns an array of objects that contain the calculated percentages of positive, neutral, and
 * negative tweets for each trend in the database.
 */
function operation2(db) {

    trends = db.getCollection('Trends').find({});

    results = [];

    trends.forEach(function (trend) {
        result = db.getCollection('Trends').aggregate(
            [
                {
                    $match: {
                        name: trend.name,
                        location: trend.location,
                        date: trend.date
                    }
                }, {
                    $unwind: {
                        path: '$tweets'
                    }
                }, {
                    $lookup: {
                        from: 'Tweets',
                        localField: 'tweets',
                        foreignField: '_id',
                        as: 'tweetsData'
                    }
                }, {
                    $unwind: {
                        path: '$tweetsData'
                    }
                }, {
                    $group: {
                        _id: '$_id',
                        totalTweets: {
                            $sum: 1
                        },
                        positiveTweets: {
                            $sum: {
                                $cond: [
                                    {
                                        $gt: [
                                            '$tweetsData.sentiment', 0.2
                                        ]
                                    }, 1, 0
                                ]
                            }
                        },
                        neutralTweets: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            {
                                                $gte: [
                                                    '$tweetsData.sentiment', -0.2
                                                ]
                                            }, {
                                                $lte: [
                                                    '$tweetsData.sentiment', 0.2
                                                ]
                                            }
                                        ]
                                    }, 1, 0
                                ]
                            }
                        },
                        negativeTweets: {
                            $sum: {
                                $cond: [
                                    {
                                        $lt: [
                                            '$tweetsData.sentiment', -0.2
                                        ]
                                    }, 1, 0
                                ]
                            }
                        }
                    }
                }, {
                    $project: {
                        totalTweets: 1,
                        positivePercentage: {
                            $multiply: [
                                {
                                    $divide: [
                                        '$positiveTweets', '$totalTweets'
                                    ]
                                }, 100
                            ]
                        },
                        neutralPercentage: {
                            $multiply: [
                                {
                                    $divide: [
                                        '$neutralTweets', '$totalTweets'
                                    ]
                                }, 100
                            ]
                        },
                        negativePercentage: {
                            $multiply: [
                                {
                                    $divide: [
                                        '$negativeTweets', '$totalTweets'
                                    ]
                                }, 100
                            ]
                        }
                    }
                }, {
                    $project: {
                        _id: 0,
                        name: trend.name,
                        location: trend.location,
                        date: trend.date,
                        positivePercentage: 1,
                        neutralPercentage: 1,
                        negativePercentage: 1
                    }
                }
            ]
        );

        results.push(result.toArray()[0]);

    });

    return results;

}

/*
    3. TREND DIFFUSION DEGREE
    Given a certain trend, identify all the users who have published tweets that belong to it and based on their number of 
    followers identify how many people have been reached by the trend, as the sum of the number of followers (which is 
    clearly an approximation)
*/

/**
 * The `operation3` function calculates the diffusion degree of a trend by summing the number of
 * followers of users who have commented on tweets related to the trend and the number of followers of
 * users who have posted tweets related to the trend.
 * @param db - The "db" parameter is the database object that is used to interact with the database. It
 * is assumed to be an instance of a database driver or an object that provides methods to perform
 * database operations such as querying and updating data.
 * @param trendName - The name of the trend you want to search for.
 * @param trendLocation - The `trendLocation` parameter is the location of the trend. It specifies the
 * location where the trend is happening, such as a city, country, or region.
 * @param trendDate - The trendDate parameter represents the date of the trend. It is used to find the
 * trend in the database based on its name, location, and date.
 * @returns an object with the following properties:
 */
function operation3(db, trendName, trendLocation, trendDate) {

    var trend = db.getCollection("Trends").findOne({
        name: trendName,
        location: trendLocation,
        date: trendDate
    });

    if (!trend) {
        return {
            error: "Trend not found"
        };
    }

    var tweetIds = trend.tweets;

    var comments = db.getCollection("Tweets").aggregate([
        {
            $match: {
                _id: {
                    $in: tweetIds
                }
            }
        },
        {
            $unwind: {
                path: '$comments'
            }
        }

    ]).toArray();

    ids = {};

    comments.forEach(element => {
        comment_user_id = element.comments.user_id;
        // if the user with tweet_user_id is in the Users collection, then add it to the ids
        // if the user with comment_user_id is in the Users collection, then add it to the ids
        user = db.getCollection("Users").findOne({ _id: comment_user_id });
        if (user) {
            ids[comment_user_id] = user.followers;
        }
    });

    tweetIds.forEach(element => {
        tweet_user_id = db.getCollection("Tweets").findOne({ _id: element }).user_id;
        user = db.getCollection("Users").findOne({ _id: tweet_user_id });
        if (user) {
            ids[tweet_user_id] = user.followers;
        }
    });

    var sum = 0;
    for (var key in ids) {
        sum += ids[key];
    }

    return {
        trendName: trendName,
        trendLocation: trendLocation,
        trendDate: trendDate,
        diffusionDegree: sum
    };
}

/*
    4. USER COHERENCE SCORE
    For each user, group the tweets he wrote by the trends in the trends array and, for each cluster, assign the user a coherence score, 
    average the scores obtained 
*/

/**
 * The function calculates a coherence score for each user based on the sentiment of their tweets and
 * normalizes the scores using min-max normalization.
 * @returns an object called `userScore`. This object contains the coherence scores for each user in
 * the database. The coherence scores are calculated based on the sentiment of the tweets written by
 * each user, grouped by trends. The scores are then averaged and normalized using min-max
 * normalization. The final scores are represented as percentages.
 */
function operation4() {

    userScore = {};

    var users = db.getCollection('Users').find({});

    users.forEach(user => {

        // get all the tweets written by the user
        tweets = db.getCollection('Tweets').find({ user_id: user._id });

        // group the tweets by trends
        tweetsByTrend = {};
        tweets.forEach(tweet => {
            var trends = tweet.trends;
            trends.forEach(trend => {
                if (tweetsByTrend[trend]) {
                    tweetsByTrend[trend].push(tweet);
                } else {
                    tweetsByTrend[trend] = [tweet];
                }
            });
        });

        // for each trend, calculate the coherence score
        var scores = {};
        for (var trend in tweetsByTrend) {
            tweets = tweetsByTrend[trend];
            var sum = 0;
            tweets.forEach(tweet => {
                sum += tweet.sentiment;
            });
            avg = tweets.length > 0 ? sum / tweets.length : 0;
            scores[trend] = avg;
        }

        // average the scores obtained
        var sum = 0;
        for (var key in scores) {
            sum += scores[key];
        }

        userScore[user.username] = Object.values(scores).length > 0 ? sum / Object.values(scores).length : 0;

    });

    // min max normalization of the scores
    var min = Math.min(...Object.values(userScore));
    var max = Math.max(...Object.values(userScore));
    for (var key in userScore) {
        userScore[key] = (userScore[key] - min) / (max - min) * 100;
    }

    return userScore;

}

/*
    5. USER'S SENTIMENT PERCENTAGES
    Given a user, take the tweets he wrote and calculate the percentages of positive, negative and neutral sentiment tweets.
*/

/**
 * The function operation5 retrieves the percentage of positive, neutral, and negative tweets for a
 * given username from a MongoDB database.
 * @param db - The "db" parameter is the database object that is used to interact with the database. It
 * is typically an instance of a database driver or client that provides methods for querying and
 * manipulating the database.
 * @param username - The `username` parameter is the username of the user whose tweets we want to
 * analyze.
 * @returns an object that contains the username, positivePercentage, neutralPercentage, and
 * negativePercentage.
 */
function operation5(db, username) {

    result = db.getCollection("Users").aggregate([

        {
            $match: {
                username: username
            }
        },
        {
            $lookup: {
                from: "Tweets",
                localField: "tweets",
                foreignField: "_id",
                as: "userTweets"
            }
        },
        {
            $unwind: "$userTweets"
        },
        {
            $group: {
                _id: "$_id",
                userTweets: { $push: "$userTweets" },
                positiveTweets: { $sum: { $cond: [{ $gt: ['$userTweets.sentiment', 0.2] }, 1, 0] } },
                neutralTweets: {
                    $sum: {
                        $cond: [{
                            $and: [{
                                $gte: [
                                    '$userTweets.sentiment', -0.2
                                ]
                            }, {
                                $lte: [
                                    '$userTweets.sentiment', 0.2
                                ]
                            }
                            ]
                        }, 1, 0]
                    }
                },
                negativeTweets: { $sum: { $cond: [{ $lt: ['$userTweets.sentiment', -0.2] }, 1, 0] } },
                totTweets: { $sum: 1 }
            }
        },
        // compute the percentages and return the precentages and the usename
        {
            $project: {
                _id: 0,
                username: username,
                positivePercentage: { $multiply: [{ $divide: ['$positiveTweets', '$totTweets'] }, 100] },
                neutralPercentage: { $multiply: [{ $divide: ['$neutralTweets', '$totTweets'] }, 100] },
                negativePercentage: { $multiply: [{ $divide: ['$negativeTweets', '$totTweets'] }, 100] }
            }
        }
    ])

    return result.toArray()[0]

}

/*
    6. ENGAGEMENT METRICS COMPUTATION
    For each trend, compute the average number of likes, shares and retweets that its posts have received
*/

/**
 * The function operation6 performs an aggregation on a MongoDB collection to calculate the average
 * likes, shares, and retweets for each trend.
 * @param db - The "db" parameter is a reference to the database object. It is used to access the
 * collections and perform operations on them.
 * @returns an array of objects that contain the following properties: name, location, date, avgLikes,
 * avgShares, and avgRetweets.
 */
function operation6(db) {

    result = db.getCollection("Trends").aggregate([
        {
            $unwind: {
                path: '$tweets'
            }
        }, {
            $lookup: {
                from: 'Tweets',
                localField: 'tweets',
                foreignField: '_id',
                as: 'tweetsData'
            }
        }, {
            $unwind: {
                path: '$tweetsData'
            }
        },
        {
            $group: {
                _id: '$_id',
                name: {
                    '$first': '$name'
                },
                location: {
                    '$first': '$location'
                },
                date: {
                    '$first': '$date'
                },
                avgLikes: {
                    '$avg': '$tweetsData.likes'
                },
                avgShares: {
                    '$avg': '$tweetsData.shares'
                },
                avgRetweets: {
                    '$avg': '$tweetsData.retweets'
                }
            }
        }, {
            $project: {
                _id: 0,
                name: 1,
                location: 1,
                date: 1,
                avgLikes: 1,
                avgShares: 1,
                avgRetweets: 1
            }
        }
    ])

    res = []
    result.toArray().forEach(function (trend) {
        res.push(trend)
    })
    return res
}

/*
    7. DISCUSSIONS' DETECTION   
    Given a trend, for each tweet associated with it, check if its comments have given rise to a discussion by 
    identifying any discordant sentiments
*/

/**
 * The function operation7 retrieves tweets and their comments from a database, classifies their
 * sentiment, and determines if a discussion took place based on the sentiment of the comments.
 * @param db - The "db" parameter is the database object that is used to interact with the database. It
 * is assumed to be an instance of a database connection or client.
 * @param trendName - The trendName parameter is the name of the trend you want to search for. It is
 * used to filter the trends in the database based on their name.
 * @param trendLocation - The `trendLocation` parameter represents the location of the trend. It is
 * used to filter the trends based on their location.
 * @param trendDate - The `trendDate` parameter represents the date of the trend. It is used to filter
 * the trends in the database based on their date.
 * @returns an array of objects. Each object contains the tweet text and a boolean value indicating
 * whether a discussion took place for that tweet.
 */
function operation7(db, trendName, trendLocation, trendDate) {

    result = db.getCollection("Trends").aggregate([
        {
            $match: {
                name: trendName,
                location: trendLocation,
                date: trendDate
            }
        },
        {
            $unwind: {
                path: '$tweets'
            }
        },
        {
            $lookup: {
                from: 'Tweets',
                localField: 'tweets',
                foreignField: '_id',
                as: 'tweetsData'
            }
        },
        {
            $unwind: {
                path: '$tweetsData'
            }
        },
        // take the tweet and classify its sentiment as
        // positive if sentiment > 0.2
        // negative if sentiment < -0.2
        // neutral otherwise
        // then for each tweet take the comments and classify their sentiment
        // if the tweet as at least one comment with a different sentiment classification
        // then a discussion took place
        {
            $project: {
                _id: 0,
                tweetText: '$tweetsData.text',
                tweet: {
                    $cond: {
                        if: {
                            $gt: ['$tweetsData.sentiment', 0.2]
                        },
                        then: 'positive',
                        else: {
                            $cond: {
                                if: {
                                    $lt: ['$tweetsData.sentiment', -0.2]
                                },
                                then: 'negative',
                                else: 'neutral'
                            }
                        }
                    }
                },
                comments: {
                    $map: {
                        input: '$tweetsData.comments',
                        as: 'comment',
                        in: {
                            $cond: {
                                if: {
                                    $gt: ['$$comment.sentiment', 0.2]
                                },
                                then: 'positive',
                                else: {
                                    $cond: {
                                        if: {
                                            $lt: ['$$comment.sentiment', -0.2]
                                        },
                                        then: 'negative',
                                        else: 'neutral'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                tweet: 1,
                comments: 1,
                tweetText: 1,
                // if the tweet's comments array is not null
                // then check if the tweet's sentiment is different from
                // the comments' sentiment
                // if so then a discussion took place
                discussion: {
                    $cond: {
                        if: {
                            $ne: ['$comments', null]
                        },
                        then: {
                            //count the number of comments with a different sentiment
                            $gt: [
                                {
                                    $size: {
                                        $filter: {
                                            input: '$comments',
                                            as: 'comment',
                                            cond: {
                                                $ne: ['$$comment', '$tweet']
                                            }
                                        }
                                    }
                                },
                                0
                            ]
                        },
                        else: false
                    }
                }

            }
        }, {
            $project: {
                _id: 0,
                tweet: 1,
                tweetText: 1,
                comments: 1,
                discussion: {
                    $cond: {
                        if: '$discussion',
                        then: true,
                        else: false
                    }
                }
            }
        }
    ])

    res = []
    result.toArray().forEach(element => {
        res.push({
            tweetText: element.tweetText,
            discussion: element.discussion
        })
    });
    return res;
}

/**
 * The function executionTime executes an operation and returns the time it took to execute the
 * operation.
 * @param {*} operation 
 * @returns the time it took to execute the operation in seconds.
 */
function executionTime(operation) {
    var start = new Date();
    operation.operation(...operation.parameters)
    var end = new Date() - start;
    // convert ms to s
    return end / 1000;
}

/**
 * The function convertArrayOfObjectsToCSV converts an array of objects to a CSV string.
 * @param {*} data 
 * @returns a CSV string.
 */
function convertArrayOfObjectsToCSV(data) {
    var header = Object.keys(data[0]).join(',');
    var csv = data.map(row =>
        Object.values(row).map(value => JSON.stringify(value)).join(',')
    );
    csv.unshift(header);
    return csv.join('\n');
}

PERFORMANCES = false // set to false to disable performances
NUM_TESTS = 10 // number of times to execute the operation

db = connect("localhost:27017")

trendName = "#Halloween";
trendLocation = "Italy";
trendDate = "2023-11-01T16:29:31.292726";
username = "@Ex_puppypaws"

db = db.getSiblingDB('Twitter')

var operations = [
    {
        name: "AVERAGE SENTIMENT PER TREND",
        operation: operation1,
        parameters: [db]
    },
    {
        name: "SENTIMENT PERCENTAGES",
        operation: operation2,
        parameters: [db]
    },
    {
        name: "TREND DIFFUSION DEGREE",
        operation: operation3,
        parameters: [db, trendName, trendLocation, trendDate]
    },
    {
        name: "USER COHERENCE SCORE",
        operation: operation4,
        parameters: [db]
    },
    {
        name: "USER'S SENTIMENT PERCENTAGES",
        operation: operation5,
        parameters: [db, username]
    },
    {
        name: "ENGAGEMENT METRICS COMPUTATION",
        operation: operation6,
        parameters: [db]
    },
    {
        name: "DISCUSSIONS' DETECTION",
        operation: operation7,
        parameters: [db, trendName, trendLocation, trendDate]
    }
]

if (!PERFORMANCES) {

    operations.forEach(operation => {
        print(operation.name);
        printjson(operation.operation(...operation.parameters));
    });

} else {

    executions = [];
    time = 0;
    operations.forEach(operation => {
        for (i = 0; i < NUM_TESTS; i++) {
            time += executionTime(operation);
        }
        executions.push({
            operation: operation.name,
            time: time / NUM_TESTS
        });
        time = 0;
    });

    fs.writeFile('performances/complex_queries_performances.csv', convertArrayOfObjectsToCSV(executions), function (err) {
        if (err) return console.log(err);
    });

}
