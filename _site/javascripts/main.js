/*jslint browser: true*/
/*jslint nomen: true*/
/*global $, _, Highcharts*/
$(function () {
    "use strict";
    var i, sortedData, dataSet = {};

    function addToSet(kana, kanji) {

        if (!(dataSet.hasOwnProperty(kana))) {
            dataSet[kana] = [kanji];
        }
        if (dataSet.hasOwnProperty(kana) && (dataSet[kana].indexOf(kanji) === -1)) {
            dataSet[kana].push(kanji);
        }
    }

    function hiragana2katakana(text) {
        var i, c, newText = "";

        for (i = 0; i < text.length; i += 1) {
            c = parseInt(text.charCodeAt(i) + 96, 10);
            newText += String.fromCharCode("0x" + c.toString(16));
        }
        return newText;
    }

    function get_progression_line(nb_days, nb_kanji_per_day) {
        return function (el, i) {
            var today = new Date(),
                d = new Date(today);

            d.setDate(today.getDate() - (nb_days - i));
            return {x: d, y: i * nb_kanji_per_day};
        };
    }

    function draw_chart(data) {
        var today = new Date(),
            nb_days = Math.floor((today - data[0].x) / (1000 * 60 * 60 * 24));

        if (data[data.length - 1].x !== today.getTime()) {
            data.push({
                x: today.getTime(),
                y: data[data.length - 1].y,
                marker: {enabled: false}
            });
        }

        Highcharts.setOptions({
            colors: ['rgba(153, 0, 0, 0.4)', 'rgba(105, 144, 0, 0.4)', '#0000D8']
        });

        $('#history_chart').highcharts({
            chart: {
                type: 'spline',
                backgroundColor: 'rgba(255, 255, 255, 0.1)'
            },
            title: {text: 'History chart'},
            xAxis: {
                type: 'datetime',
                dateTimeLabelFormats: {
                    month: '%e. %b',
                    year: '%b'

                },
                title: {text: 'Date'}
            },
            yAxis: {
                title: {text: 'Number of Kanji'},
                min: 0
            },
            tooltip: {
                headerFormat: '<b>{series.name}</b><br>',
                pointFormat: '{point.x:%e-%b}: {point.data}'
            },
            series: [
                {
                    name: 'Goal 2 kanji/day (2.4 years)',
                    enableMouseTracking: false,
                    marker: {enabled: false},
                    data: _.map(
                        _.range(nb_days + 1),
                        get_progression_line(nb_days, 2)
                    )
                },
                {
                    name: 'Goal 3 kanji/day (1.6 years)',
                    enableMouseTracking: false,
                    marker: {enabled: false},
                    data: _.map(
                        _.range(nb_days + 1),
                        get_progression_line(nb_days, 3)
                    )
                },
                {
                    name: 'Real progression',
                    //showInLegend: false,
                    data: data
                }
            ]
        });
    }


    $('#main_content').append('<table cellpadding="0" cellspacing="0" border="0" class="display" id="kanji_learnt"></table>');

    // 1. Fetch data
    $.getJSON('data/kanji_learnt.json').done(function (data) {
        var today = new Date(),
            now_time = " " + today.getHours() + ":" + today.getMinutes();

        // 2. Manipulate data
        $.map(data, function (el) {
            for (i = 0; i < el.onyomi.length; i += 1) {
                if (el.onyomi[i] !== "") {
                    addToSet(el.onyomi[i], el.kanji);
                }
            }
            for (i = 0; i < el.kunyomi.length; i += 1) {
                if (el.kunyomi[i] !== "") {
                    addToSet(el.kunyomi[i], el.kanji);
                }
            }
        });

        // 3. Display data
        $('#kanji_learnt').dataTable({
            paging: false,
            data: $.map(dataSet, function (values, key) {
                return {"Kana": key, "Kanji": values};
            }),
            columns: [
                { "data": "Kana", "title": "Kana" },
                { "data": "Kanji", "title": "Kanji" }
            ]
        });

        // 4. Set most recently learnt kanjis
        sortedData = data.sort(function (a, b) {
            a = new Date(a.added);
            b = new Date(b.added);
            return a > b ? -1 : a < b ? 1 : 0;
        });
        sortedData.slice(0, 12).forEach(function (obj) {
            var i, date, days_ago, kanji, details = " (", katakana = [];
            for (i = 0; i < obj.onyomi.length; i += 1) {
                katakana.push(hiragana2katakana(obj.onyomi[i]));
            }

            days_ago = Math.floor((today - new Date(obj.added + now_time)) / (1000 * 60 * 60 * 24));
            if (days_ago === 0) {
                days_ago = "today";
            } else {
                days_ago += (days_ago === 1) ? " day" : " days";
            }

            date = $(document.createElement('span'))
                .html("[" + days_ago + "] ")
                .css('font-style', 'oblique');
            kanji = $(document.createElement('span'))
                .html(obj.kanji)
                .css('font-weight', 'bold');

            if (katakana[0] !== "") {
                details += katakana.join();
            }
            if (katakana[0] !== "" && obj.kunyomi[0] !== "") {
                details += ", ";
            }
            if (obj.kunyomi[0] !== "") {
                details += obj.kunyomi.join();
            }
            details = $(document.createElement('span'))
                .html(details + "): "  + obj.english);

            $(document.createElement('li'))
                .append(date)
                .append(kanji)
                .append(details)
                .appendTo('#latest_kanji>ul');
        });

        // 5. Set history chart
        var completionEstimate,
            nbDaysLater = 0,
            sumKanji = 0,
            groupBy = _.groupBy(data.reverse(), function (obj) {return obj.added; });

        nbDaysLater = Math.floor(1760 * Object.keys(groupBy).length / data.length);
        completionEstimate = new Date(today);
        completionEstimate.setDate(completionEstimate.getDate() + nbDaysLater);

        draw_chart(_.map(
            groupBy,
            function (obj, key) {
                var result,
                    elDate = new Date(key + now_time).getTime(),
                    elData = _.map(obj, function (el) { return el.kanji; });
                sumKanji += _.reduce(obj, function (nbKanji, element) {
                    return parseInt(nbKanji, 10) + 1;
                }, 0);

                result = { x: elDate, y: sumKanji, data: elData};
                if (key === data[data.length - 1].added) {
                    result.dataLabels = {
                        enabled: true,
                        align: 'left',
                        style: {fontWeight: 'bold'},
                        x: -75,
                        y: -40,
                        verticalAlign: 'middle',
                        overflow: true,
                        crop: false,
                        format: 'Completion est.<br />' + completionEstimate.toDateString()
                    };
                }
                return result;
            }
        ));

        // 6. Show total number of Kanji learnt
        $('#total_kanji').html(data.length);
        $.getJSON('http://query.yahooapis.com/v1/public/yql?callback=?', {
            q: 'select * from html where url="http://kanjidamage.com/kanji" and xpath="//tr"',
            format: 'json'
        }, function (content) {
            var tr, position;
            tr = _.find(_.flatten(content.query.results), function (element) {
                return element.td[1].a.content === data[data.length - 1].kanji;
            });
            position = tr.td[0].p;
            $('.spinner')
                .hide()
                .after("KanjiDamage position: <strong>" + position + "</strong>/1760");
        });
    });
});
/*jslint nomen: false*/
